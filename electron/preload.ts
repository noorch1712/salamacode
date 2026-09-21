import { contextBridge, ipcRenderer } from 'electron';
import { SalamaAPIBridge } from '../src/types/index.js';

const salamaAPI: SalamaAPIBridge = {
  isElectron: true,

  chooseDirectory: () => ipcRenderer.invoke('workspace:choose-directory'),
  getWorkspaceInfo: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:get-info', workspacePath),

  listFiles: (workspacePath: string, relativeDir?: string) =>
    ipcRenderer.invoke('filesystem:list-files', workspacePath, relativeDir),

  readFile: (workspacePath: string, relativeFilePath: string, startLine?: number, endLine?: number) =>
    ipcRenderer.invoke('filesystem:read-file', workspacePath, relativeFilePath, startLine, endLine),

  writeFile: (workspacePath: string, relativeFilePath: string, content: string) =>
    ipcRenderer.invoke('filesystem:write-file', workspacePath, relativeFilePath, content),

  createDirectory: (workspacePath: string, relativeDirPath: string) =>
    ipcRenderer.invoke('filesystem:create-directory', workspacePath, relativeDirPath),

  editFile: (
    workspacePath: string,
    relativeFilePath: string,
    content: string,
    oldText?: string,
    newText?: string
  ) => ipcRenderer.invoke('filesystem:edit-file', workspacePath, relativeFilePath, content, oldText, newText),

  searchFiles: (workspacePath: string, query: string) =>
    ipcRenderer.invoke('filesystem:search-files', workspacePath, query),

  findFiles: (workspacePath: string, pattern: string) =>
    ipcRenderer.invoke('filesystem:find-files', workspacePath, pattern),

  getFileInfo: (workspacePath: string, relativeFilePath: string) =>
    ipcRenderer.invoke('filesystem:get-file-info', workspacePath, relativeFilePath),

  runCommand: (workspacePath: string, command: string, options?: any) =>
    ipcRenderer.invoke('terminal:run-command', workspacePath, command, options),

  killCommand: (processId?: string) =>
    ipcRenderer.invoke('terminal:kill-command', processId),

  getBackups: (workspacePath: string) =>
    ipcRenderer.invoke('filesystem:get-backups', workspacePath),

  rollbackFile: (workspacePath: string, backupId: string) =>
    ipcRenderer.invoke('filesystem:rollback-file', workspacePath, backupId),

  gitStatus: (workspacePath: string) =>
    ipcRenderer.invoke('git:status', workspacePath),

  gitDiff: (workspacePath: string) =>
    ipcRenderer.invoke('git:diff', workspacePath),

  gitLog: (workspacePath: string, limit?: number) =>
    ipcRenderer.invoke('git:log', workspacePath, limit),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  getHistory: () => ipcRenderer.invoke('history:get'),
  saveHistory: (item) => ipcRenderer.invoke('history:save', item),
};

// Expose safe API to renderer
contextBridge.exposeInMainWorld('salamaAPI', salamaAPI);

declare global {
  interface Window {
    salamaAPI?: SalamaAPIBridge;
  }
}
