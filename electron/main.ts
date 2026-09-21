import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupWorkspaceIPC } from './ipc/workspace.js';
import { setupFilesystemIPC } from './ipc/filesystem.js';
import { setupSettingsIPC } from './ipc/settings.js';
import { setupTerminalIPC } from './ipc/terminal.js';
import { setupGitIPC } from './ipc/git.js';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'SalamaCode — AI Coding Agent',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    const devUrl = process.env.DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Register IPC handlers
  setupWorkspaceIPC();
  await setupFilesystemIPC();
  setupSettingsIPC();
  await setupTerminalIPC();
  await setupGitIPC();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
