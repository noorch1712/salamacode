import { dialog, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { WorkspaceInfo } from '../../src/types/index.js';

export function setupWorkspaceIPC() {
  ipcMain.handle('workspace:choose-directory', async (event: any) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win || (undefined as any), {
      title: 'Pilih Folder Workspace Project',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('workspace:get-info', async (_event: any, workspacePath: string): Promise<WorkspaceInfo> => {
    const resolved = path.resolve(workspacePath);
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory');
      }
      return {
        path: resolved,
        name: path.basename(resolved) || resolved,
        lastOpened: Date.now(),
      };
    } catch (err: any) {
      throw new Error(`Failed to access workspace directory: ${err.message}`);
    }
  });
}
