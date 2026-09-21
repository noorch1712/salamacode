import fs from 'fs/promises';
import path from 'path';
import { FileBackupItem } from '../../src/types/index.js';
import { validateWorkspacePath } from './pathGuard.js';

export async function createBackup(
  workspacePath: string,
  relativeFilePath: string,
  toolName: string
): Promise<FileBackupItem | null> {
  const guard = validateWorkspacePath(workspacePath, relativeFilePath);
  if (!guard.isValid) return null;

  try {
    const exists = await fs
      .stat(guard.resolvedPath)
      .then((s) => s.isFile())
      .catch(() => false);
    if (!exists) return null;

    const content = await fs.readFile(guard.resolvedPath, 'utf-8');
    const backupsDir = path.join(workspacePath, '.salama', 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = relativeFilePath.replace(/[\/\\]/g, '_');
    const backupFileName = `${timestamp}_${safeName}`;
    const backupPath = path.join(backupsDir, backupFileName);

    await fs.writeFile(backupPath, content, 'utf-8');

    const item: FileBackupItem = {
      id: `bk_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
      originalPath: guard.resolvedPath,
      relativePath: relativeFilePath,
      backupPath,
      timestamp,
      toolName,
    };

    // Store in metadata file
    const indexFile = path.join(backupsDir, 'index.json');
    let list: FileBackupItem[] = [];
    try {
      const idxContent = await fs.readFile(indexFile, 'utf-8');
      list = JSON.parse(idxContent);
    } catch {
      list = [];
    }
    list.unshift(item);
    await fs.writeFile(indexFile, JSON.stringify(list.slice(0, 100), null, 2), 'utf-8');

    return item;
  } catch (err) {
    console.error('Failed to create backup:', err);
    return null;
  }
}

export async function listBackups(workspacePath: string): Promise<FileBackupItem[]> {
  try {
    const indexFile = path.join(workspacePath, '.salama', 'backups', 'index.json');
    const content = await fs.readFile(indexFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function restoreBackup(workspacePath: string, backupId: string): Promise<boolean> {
  try {
    const backups = await listBackups(workspacePath);
    const target = backups.find((b) => b.id === backupId);
    if (!target) return false;

    const backupContent = await fs.readFile(target.backupPath, 'utf-8');
    await fs.writeFile(target.originalPath, backupContent, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to restore backup:', err);
    return false;
  }
}
