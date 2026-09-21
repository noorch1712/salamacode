import { execFile } from 'child_process';
import util from 'util';
import { GitCommitItem, GitStatusResult } from '../../src/types/index.js';
import { validateWorkspacePath } from '../security/pathGuard.js';

const execFileAsync = util.promisify(execFile);

export async function getGitStatus(workspacePath: string): Promise<GitStatusResult> {
  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) throw new Error('Invalid workspace path');

  try {
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: guard.resolvedPath }
    );
    const branch = branchOut.trim();

    const { stdout: statusOut } = await execFileAsync(
      'git',
      ['status', '--porcelain'],
      { cwd: guard.resolvedPath }
    );

    const lines = statusOut.split('\n').filter((l) => l.trim().length > 0);
    const modified: string[] = [];
    const untracked: string[] = [];
    const staged: string[] = [];

    for (const line of lines) {
      const code = line.substring(0, 2);
      const file = line.substring(3).trim();
      if (code.includes('?')) {
        untracked.push(file);
      } else if (code[0] !== ' ' && code[0] !== '?') {
        staged.push(file);
      } else if (code[1] === 'M' || code[1] === 'D') {
        modified.push(file);
      }
    }

    return {
      isGitRepo: true,
      branch,
      modified,
      untracked,
      staged,
      clean: lines.length === 0,
    };
  } catch (err) {
    return {
      isGitRepo: false,
      modified: [],
      untracked: [],
      staged: [],
      clean: true,
    };
  }
}

export async function getGitDiff(workspacePath: string): Promise<string> {
  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) throw new Error('Invalid workspace path');

  try {
    const { stdout } = await execFileAsync('git', ['diff'], {
      cwd: guard.resolvedPath,
      maxBuffer: 1024 * 1024 * 2, // 2MB
    });
    return stdout;
  } catch (err) {
    return '';
  }
}

export async function getGitLog(
  workspacePath: string,
  limit = 10
): Promise<GitCommitItem[]> {
  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) throw new Error('Invalid workspace path');

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `-${limit}`, '--pretty=format:%h|%an|%ad|%s', '--date=short'],
      { cwd: guard.resolvedPath }
    );

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((l) => {
      const [hash, author, date, message] = l.split('|');
      return {
        hash: hash || '',
        author: author || '',
        date: date || '',
        message: message || '',
      };
    });
  } catch {
    return [];
  }
}

export async function setupGitIPC() {
  let ipcMain: any;
  try {
    const electron: any = await import('electron');
    ipcMain = electron.ipcMain || electron.default?.ipcMain;
  } catch {
    return;
  }
  if (!ipcMain) return;

  ipcMain.handle('git:status', async (_event: any, workspacePath: string) => {
    return await getGitStatus(workspacePath);
  });
  ipcMain.handle('git:diff', async (_event: any, workspacePath: string) => {
    return await getGitDiff(workspacePath);
  });
  ipcMain.handle('git:log', async (_event: any, workspacePath: string, limit?: number) => {
    return await getGitLog(workspacePath, limit);
  });
}

