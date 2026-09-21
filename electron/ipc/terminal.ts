import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { TerminalCommandResult } from '../../src/types/index.js';
import { evaluateCommandSecurity } from '../security/commandGuard.js';
import { validateWorkspacePath } from '../security/pathGuard.js';

const activeProcesses = new Map<string, ChildProcess>();

export function killRunningProcess(processId?: string): boolean {
  if (processId) {
    const proc = activeProcesses.get(processId);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      activeProcesses.delete(processId);
      return true;
    }
    return false;
  }

  // Kill all active processes
  for (const [id, proc] of activeProcesses.entries()) {
    try {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    } catch {}
    activeProcesses.delete(id);
  }
  return true;
}

export async function executeTerminalCommand(
  workspacePath: string,
  command: string,
  options?: { timeoutMs?: number; onStdout?: (chunk: string) => void; onStderr?: (chunk: string) => void }
): Promise<TerminalCommandResult> {
  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) {
    throw new Error('Workspace path is invalid');
  }

  const security = evaluateCommandSecurity(command);
  if (security.level === 'BLOCKED_BY_DEFAULT') {
    throw new Error(security.reason || 'Command blocked by security policy');
  }

  const processId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timeoutMs = options?.timeoutMs || 120000; // 2 minutes default

  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let isKilled = false;

    // Use platform appropriate shell
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: guard.resolvedPath,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CI: 'true',
      },
    });

    activeProcesses.set(processId, child);

    const timer = setTimeout(() => {
      isKilled = true;
      try {
        child.kill('SIGTERM');
      } catch {}
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutData += text;
      options?.onStdout?.(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderrData += text;
      options?.onStderr?.(text);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      activeProcesses.delete(processId);
      resolve({
        command,
        exitCode: 1,
        stdout: stdoutData,
        stderr: (stderrData ? stderrData + '\n' : '') + `Spawn error: ${err.message}`,
        durationMs: Date.now() - startTime,
        killed: isKilled,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      activeProcesses.delete(processId);
      resolve({
        command,
        exitCode: code ?? (isKilled ? 143 : 0),
        stdout: stdoutData,
        stderr: stderrData,
        durationMs: Date.now() - startTime,
        killed: isKilled,
      });
    });
  });
}

export async function setupTerminalIPC() {
  let ipcMain: any;
  try {
    const electron: any = await import('electron');
    ipcMain = electron.ipcMain || electron.default?.ipcMain;
  } catch {
    return;
  }
  if (!ipcMain) return;

  ipcMain.handle(
    'terminal:run-command',
    async (_event: any, workspacePath: string, command: string, options?: any) => {
      return await executeTerminalCommand(workspacePath, command, options);
    }
  );

  ipcMain.handle('terminal:kill-command', async (_event: any, processId?: string) => {
    return killRunningProcess(processId);
  });
}

