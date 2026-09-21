import fs from 'fs/promises';
import path from 'path';
import { validateWorkspacePath } from '../security/pathGuard.js';
import {
  FileNode,
  FileContent,
  SearchMatch,
  FileInfo,
  FileBackupItem,
} from '../../src/types/index.js';
import { createBackup, listBackups, restoreBackup } from '../security/backupManager.js';

// Directories to ignore for performance and cleanliness
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vscode',
  '.salama',
  'dist',
  'build',
  'out',
  '.turbo',
  '.cache',
]);

export async function scanDirectory(
  workspaceRoot: string,
  currentRelPath = '',
  maxDepth = 5,
  currentDepth = 0
): Promise<FileNode[]> {
  if (currentDepth > maxDepth) return [];

  const targetDir = currentRelPath
    ? path.join(workspaceRoot, currentRelPath)
    : workspaceRoot;

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      const relPath = currentRelPath ? path.join(currentRelPath, entry.name) : entry.name;
      const fullPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        let children: FileNode[] = [];
        try {
          children = await scanDirectory(
            workspaceRoot,
            relPath,
            maxDepth,
            currentDepth + 1
          );
        } catch {
          children = [];
        }

        nodes.push({
          name: entry.name,
          path: fullPath,
          relativePath: relPath.replace(/\\/g, '/'),
          isDirectory: true,
          children,
        });
      } else {
        let size = 0;
        let modifiedAt = 0;
        try {
          const stats = await fs.stat(fullPath);
          size = stats.size;
          modifiedAt = stats.mtimeMs;
        } catch {}

        nodes.push({
          name: entry.name,
          path: fullPath,
          relativePath: relPath.replace(/\\/g, '/'),
          isDirectory: false,
          size,
          modifiedAt,
        });
      }
    }

    return nodes;
  } catch {
    return [];
  }
}

// Search files content recursively
export async function searchInFiles(
  workspaceRoot: string,
  query: string,
  relDir = '',
  maxResults = 50
): Promise<SearchMatch[]> {
  const dirPath = relDir ? path.join(workspaceRoot, relDir) : workspaceRoot;
  let matches: SearchMatch[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (matches.length >= maxResults) break;
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const itemRelPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subMatches = await searchInFiles(workspaceRoot, query, itemRelPath, maxResults - matches.length);
        matches = matches.concat(subMatches);
      } else {
        // Skip large binaries or media
        const ext = path.extname(entry.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.zip', '.ico', '.exe', '.pdf', '.woff', '.woff2'].includes(ext)) {
          continue;
        }

        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 1024 * 1024 * 2) continue; // Skip files > 2MB

          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const lowerQuery = query.toLowerCase();

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= maxResults) break;
            const line = lines[i];
            if (line.toLowerCase().includes(lowerQuery)) {
              matches.push({
                filePath: itemRelPath.replace(/\\/g, '/'),
                lineNumber: i + 1,
                lineContent: line.trim(),
              });
            }
          }
        } catch {}
      }
    }
  } catch {}

  return matches;
}

// Find files matching pattern (e.g. *.tsx, *.php, *.blade.php)
export async function findFilesByPattern(
  workspaceRoot: string,
  pattern: string,
  relDir = ''
): Promise<string[]> {
  const dirPath = relDir ? path.join(workspaceRoot, relDir) : workspaceRoot;
  let matchedFiles: string[] = [];

  // Convert simple wildcard to regex
  const regexPattern = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    'i'
  );

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const itemRelPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findFilesByPattern(workspaceRoot, pattern, itemRelPath);
        matchedFiles = matchedFiles.concat(subFiles);
      } else {
        if (regexPattern.test(entry.name)) {
          matchedFiles.push(itemRelPath.replace(/\\/g, '/'));
        }
      }
    }
  } catch {}

  return matchedFiles;
}

export async function setupFilesystemIPC() {
  let ipcMain: any;
  try {
    const electron: any = await import('electron');
    ipcMain = electron.ipcMain || electron.default?.ipcMain;
  } catch {
    return;
  }
  if (!ipcMain) return;

  // List files within workspace root
  ipcMain.handle(
    'filesystem:list-files',
    async (_event: any, workspacePath: string, relativeDir?: string): Promise<FileNode[]> => {
      const guard = validateWorkspacePath(workspacePath, relativeDir || '.');
      if (!guard.isValid) {
        throw new Error(guard.reason || 'Invalid workspace directory');
      }

      return await scanDirectory(workspacePath, relativeDir || '', 5, 0);
    }
  );

  // Read file with optional line range
  ipcMain.handle(
    'filesystem:read-file',
    async (
      _event: any,
      workspacePath: string,
      relativeFilePath: string,
      startLine?: number,
      endLine?: number
    ): Promise<FileContent> => {
      const guard = validateWorkspacePath(workspacePath, relativeFilePath);
      if (!guard.isValid) {
        throw new Error(guard.reason || 'Invalid file path');
      }

      try {
        const rawContent = await fs.readFile(guard.resolvedPath, 'utf-8');
        const stat = await fs.stat(guard.resolvedPath);
        const lines = rawContent.split('\n');

        let content = rawContent;
        if (startLine !== undefined && endLine !== undefined) {
          const s = Math.max(1, startLine) - 1;
          const e = Math.min(lines.length, endLine);
          content = lines.slice(s, e).join('\n');
        }

        return {
          path: guard.resolvedPath,
          relativePath: guard.relativePath,
          content,
          size: stat.size,
          lineCount: lines.length,
          isBinary: false,
        };
      } catch (err: any) {
        throw new Error(`Failed to read file: ${err.message}`);
      }
    }
  );

  // Write file with backup
  ipcMain.handle(
    'filesystem:write-file',
    async (
      _event: any,
      workspacePath: string,
      relativeFilePath: string,
      content: string
    ): Promise<{ success: boolean; path: string; backupPath?: string }> => {
      const guard = validateWorkspacePath(workspacePath, relativeFilePath);
      if (!guard.isValid) {
        throw new Error(guard.reason || 'Invalid write target');
      }

      try {
        // Create backup if file existed
        const backup = await createBackup(workspacePath, relativeFilePath, 'write_file');

        // Ensure parent directory exists
        const parentDir = path.dirname(guard.resolvedPath);
        await fs.mkdir(parentDir, { recursive: true });

        await fs.writeFile(guard.resolvedPath, content, 'utf-8');
        return {
          success: true,
          path: guard.resolvedPath,
          backupPath: backup?.backupPath,
        };
      } catch (err: any) {
        throw new Error(`Failed to write file: ${err.message}`);
      }
    }
  );

  // Create directory
  ipcMain.handle(
    'filesystem:create-directory',
    async (
      _event: any,
      workspacePath: string,
      relativeDirPath: string
    ): Promise<{ success: boolean; path: string }> => {
      const guard = validateWorkspacePath(workspacePath, relativeDirPath);
      if (!guard.isValid) {
        throw new Error(guard.reason || 'Invalid directory target');
      }

      try {
        await fs.mkdir(guard.resolvedPath, { recursive: true });
        return { success: true, path: guard.resolvedPath };
      } catch (err: any) {
        throw new Error(`Failed to create directory: ${err.message}`);
      }
    }
  );

  // Edit file with backup and optional patch support
  ipcMain.handle(
    'filesystem:edit-file',
    async (
      _event: any,
      workspacePath: string,
      relativeFilePath: string,
      content: string,
      oldText?: string,
      newText?: string
    ): Promise<{ success: boolean; path: string; backupPath?: string }> => {
      const guard = validateWorkspacePath(workspacePath, relativeFilePath);
      if (!guard.isValid) {
        throw new Error(guard.reason || 'Invalid edit target');
      }

      try {
        const backup = await createBackup(workspacePath, relativeFilePath, 'edit_file');
        let finalContent = content;

        if (oldText !== undefined && newText !== undefined) {
          const current = await fs.readFile(guard.resolvedPath, 'utf-8');
          if (!current.includes(oldText)) {
            throw new Error(`Target text to replace was not found in ${relativeFilePath}`);
          }
          finalContent = current.replace(oldText, newText);
        }

        await fs.writeFile(guard.resolvedPath, finalContent, 'utf-8');
        return {
          success: true,
          path: guard.resolvedPath,
          backupPath: backup?.backupPath,
        };
      } catch (err: any) {
        throw new Error(`Failed to edit file: ${err.message}`);
      }
    }
  );

  // Search code across files
  ipcMain.handle(
    'filesystem:search-files',
    async (_event: any, workspacePath: string, query: string): Promise<SearchMatch[]> => {
      const guard = validateWorkspacePath(workspacePath, '.');
      if (!guard.isValid) throw new Error('Invalid workspace path');
      return await searchInFiles(guard.resolvedPath, query);
    }
  );

  // Find files by pattern
  ipcMain.handle(
    'filesystem:find-files',
    async (_event: any, workspacePath: string, pattern: string): Promise<string[]> => {
      const guard = validateWorkspacePath(workspacePath, '.');
      if (!guard.isValid) throw new Error('Invalid workspace path');
      return await findFilesByPattern(guard.resolvedPath, pattern);
    }
  );

  // Get file info
  ipcMain.handle(
    'filesystem:get-file-info',
    async (_event: any, workspacePath: string, relativeFilePath: string): Promise<FileInfo> => {
      const guard = validateWorkspacePath(workspacePath, relativeFilePath);
      if (!guard.isValid) throw new Error('Invalid file path');

      const stat = await fs.stat(guard.resolvedPath);
      let lines = 0;
      if (!stat.isDirectory()) {
        try {
          const content = await fs.readFile(guard.resolvedPath, 'utf-8');
          lines = content.split('\n').length;
        } catch {}
      }

      return {
        path: guard.resolvedPath,
        relativePath: guard.relativePath,
        size: stat.size,
        lines,
        isDirectory: stat.isDirectory(),
        extension: path.extname(guard.resolvedPath),
        modifiedAt: stat.mtimeMs,
      };
    }
  );

  // Backups & Rollback
  ipcMain.handle(
    'filesystem:get-backups',
    async (_event: any, workspacePath: string): Promise<FileBackupItem[]> => {
      return await listBackups(workspacePath);
    }
  );

  ipcMain.handle(
    'filesystem:rollback-file',
    async (_event: any, workspacePath: string, backupId: string): Promise<boolean> => {
      return await restoreBackup(workspacePath, backupId);
    }
  );
}
