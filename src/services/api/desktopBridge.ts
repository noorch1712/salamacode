import {
  AIUsageSummary,
  AppSettings,
  FileBackupItem,
  FileContent,
  FileInfo,
  FileNode,
  GitCommitItem,
  GitStatusResult,
  ProjectHistoryItem,
  SalamaAPIBridge,
  SearchMatch,
  TerminalCommandResult,
  WorkspaceInfo,
} from '../../types/index.js';
import { uiFetch } from './apiClient.js';

class DesktopBridge implements SalamaAPIBridge {
  get isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.salamaAPI?.isElectron;
  }

  async chooseDirectory(): Promise<string | null> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.chooseDirectory();
    }

    // Web Fallback: Get preset or default
    const presets = await this.listPresetWorkspaces();
    if (presets && presets.length > 0) {
      return presets[0].path;
    }
    return 'workspaces/TestApp';
  }

  async listPresetWorkspaces(): Promise<WorkspaceInfo[]> {
    if (this.isElectron && window.salamaAPI?.listPresetWorkspaces) {
      return await window.salamaAPI.listPresetWorkspaces();
    }
    try {
      const res = await uiFetch('/api/workspace/presets');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getWorkspaceInfo(workspacePath: string): Promise<WorkspaceInfo> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.getWorkspaceInfo(workspacePath);
    }
    const res = await uiFetch('/api/workspace/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to fetch workspace info');
    }
    return await res.json();
  }

  async listFiles(workspacePath: string, relativeDir?: string): Promise<FileNode[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.listFiles(workspacePath, relativeDir);
    }
    const res = await uiFetch('/api/filesystem/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeDir }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to list files');
    }
    return await res.json();
  }

  async readFile(
    workspacePath: string,
    relativeFilePath: string,
    startLine?: number,
    endLine?: number
  ): Promise<FileContent> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.readFile(workspacePath, relativeFilePath, startLine, endLine);
    }
    const res = await uiFetch('/api/filesystem/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeFilePath, startLine, endLine }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to read file');
    }
    return await res.json();
  }

  async writeFile(
    workspacePath: string,
    relativeFilePath: string,
    content: string
  ): Promise<{ success: boolean; path: string; backupPath?: string }> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.writeFile(workspacePath, relativeFilePath, content);
    }
    const res = await uiFetch('/api/filesystem/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeFilePath, content }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to write file');
    }
    return await res.json();
  }

  async createDirectory(
    workspacePath: string,
    relativeDirPath: string
  ): Promise<{ success: boolean; path: string }> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.createDirectory(workspacePath, relativeDirPath);
    }
    const res = await uiFetch('/api/filesystem/create-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeDirPath }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create directory');
    }
    return await res.json();
  }

  async editFile(
    workspacePath: string,
    relativeFilePath: string,
    content: string,
    oldText?: string,
    newText?: string
  ): Promise<{ success: boolean; path: string; backupPath?: string }> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.editFile(
        workspacePath,
        relativeFilePath,
        content,
        oldText,
        newText
      );
    }
    const res = await uiFetch('/api/filesystem/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeFilePath, content, oldText, newText }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to edit file');
    }
    return await res.json();
  }

  async searchFiles(workspacePath: string, query: string): Promise<SearchMatch[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.searchFiles(workspacePath, query);
    }
    const res = await uiFetch('/api/filesystem/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, query }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to search files');
    }
    return await res.json();
  }

  async findFiles(workspacePath: string, pattern: string): Promise<string[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.findFiles(workspacePath, pattern);
    }
    const res = await uiFetch('/api/filesystem/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, pattern }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to find files');
    }
    return await res.json();
  }

  async getFileInfo(workspacePath: string, relativeFilePath: string): Promise<FileInfo> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.getFileInfo(workspacePath, relativeFilePath);
    }
    const res = await uiFetch('/api/filesystem/file-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, relativeFilePath }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to get file info');
    }
    return await res.json();
  }

  async runCommand(
    workspacePath: string,
    command: string,
    options?: { timeoutMs?: number }
  ): Promise<TerminalCommandResult> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.runCommand(workspacePath, command, options);
    }
    const res = await uiFetch('/api/terminal/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, command, options }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        command,
        exitCode: 1,
        stdout: '',
        stderr: data.stderr || data.error || 'Command execution failed',
        durationMs: 0,
        error: data.error,
      };
    }
    return await res.json();
  }

  async killCommand(processId?: string): Promise<boolean> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.killCommand(processId);
    }
    try {
      const res = await uiFetch('/api/terminal/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId }),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  async getBackups(workspacePath: string): Promise<FileBackupItem[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.getBackups(workspacePath);
    }
    try {
      const res = await uiFetch('/api/filesystem/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async rollbackFile(workspacePath: string, backupId: string): Promise<boolean> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.rollbackFile(workspacePath, backupId);
    }
    try {
      const res = await uiFetch('/api/filesystem/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath, backupId }),
      });
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  }

  async gitStatus(workspacePath: string): Promise<GitStatusResult> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.gitStatus(workspacePath);
    }
    try {
      const res = await uiFetch('/api/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath }),
      });
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch {
      return { isGitRepo: false, modified: [], untracked: [], staged: [], clean: true };
    }
  }

  async gitDiff(workspacePath: string): Promise<string> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.gitDiff(workspacePath);
    }
    try {
      const res = await uiFetch('/api/git/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath }),
      });
      const data = await res.json();
      return data.diff || '';
    } catch {
      return '';
    }
  }

  async gitLog(workspacePath: string, limit?: number): Promise<GitCommitItem[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.gitLog(workspacePath, limit);
    }
    try {
      const res = await uiFetch('/api/git/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath, limit }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.getSettings();
    }
    try {
      const res = await uiFetch('/api/settings');
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch {
      return {
        aiProvider: 'gemini',
        theme: 'light',
        modelName: 'gemini-3.8-flash',
        reviewMode: 'ask',
        temperature: 0.3,
        maxTokens: 8192,
        maxAgentIterations: 30,
      };
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.saveSettings(settings);
    }
    const res = await uiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      throw new Error('Failed to save settings');
    }
    return await res.json();
  }

  async getHistory(): Promise<ProjectHistoryItem[]> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.getHistory();
    }
    try {
      const res = await uiFetch('/api/history');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async saveHistory(item: ProjectHistoryItem): Promise<void> {
    if (this.isElectron && window.salamaAPI) {
      return await window.salamaAPI.saveHistory(item);
    }
    await uiFetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  }

  async testAIConnection(
    provider: 'gemini' | 'openrouter' | 'custom' = 'gemini',
    config: { apiKey?: string; model?: string; baseUrl?: string } = {}
  ): Promise<{ success: boolean; message?: string; error?: string; latencyMs?: number }> {
    const startTime = Date.now();
    try {
      const res = await uiFetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
        }),
      });
      const data = await res.json();
      return {
        ...data,
        latencyMs: data.latencyMs || Date.now() - startTime,
      };
    } catch (err: any) {
      return { success: false, error: err.message, latencyMs: Date.now() - startTime };
    }
  }

  async getAIUsage(): Promise<AIUsageSummary> {
    try {
      const res = await uiFetch('/api/ai/usage');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      byProvider: {
        gemini: 0,
        openrouter: 0,
        custom: 0,
      },
    };
  }
}

export const desktopBridge = new DesktopBridge();
