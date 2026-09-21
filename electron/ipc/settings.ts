import { app, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { AppSettings, ProjectHistoryItem } from '../../src/types/index.js';

function getStoragePaths() {
  const userDataDir = app ? app.getPath('userData') : process.cwd();
  return {
    settingsFile: path.join(userDataDir, 'salama-settings.json'),
    historyFile: path.join(userDataDir, 'salama-history.json'),
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'gemini',
  theme: 'light',
  modelName: 'gemini-3.8-flash',
};

export function setupSettingsIPC() {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    try {
      const { settingsFile } = getStoragePaths();
      const content = await fs.readFile(settingsFile, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  ipcMain.handle(
    'settings:save',
    async (_event: any, newSettings: Partial<AppSettings>): Promise<AppSettings> => {
      const { settingsFile } = getStoragePaths();
      let current: AppSettings = { ...DEFAULT_SETTINGS };
      try {
        const content = await fs.readFile(settingsFile, 'utf-8');
        current = { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
      } catch {
        // file doesn't exist yet
      }

      const merged = { ...current, ...newSettings };
      await fs.writeFile(settingsFile, JSON.stringify(merged, null, 2), 'utf-8');
      return merged;
    }
  );

  ipcMain.handle('history:get', async (): Promise<ProjectHistoryItem[]> => {
    try {
      const { historyFile } = getStoragePaths();
      const content = await fs.readFile(historyFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    'history:save',
    async (_event: any, item: ProjectHistoryItem): Promise<void> => {
      const { historyFile } = getStoragePaths();
      let list: ProjectHistoryItem[] = [];
      try {
        const content = await fs.readFile(historyFile, 'utf-8');
        list = JSON.parse(content);
      } catch {
        list = [];
      }

      // Add to front, keep max 50
      list = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 50);
      await fs.writeFile(historyFile, JSON.stringify(list, null, 2), 'utf-8');
    }
  );
}
