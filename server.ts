import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { validateWorkspacePath } from './electron/security/pathGuard.js';
import { evaluateCommandSecurity } from './electron/security/commandGuard.js';
import { createBackup, listBackups, restoreBackup } from './electron/security/backupManager.js';
import { executeTerminalCommand, killRunningProcess } from './electron/ipc/terminal.js';
import { getGitStatus, getGitDiff, getGitLog } from './electron/ipc/git.js';
import { searchInFiles, findFilesByPattern, scanDirectory } from './electron/ipc/filesystem.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '20mb' }));

// --- PRODUCTION WEB CONFIG ---
// Public web deployment guards: CORS, locked workspace root, terminal toggle.

const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'workspaces')
);

app.use((req, res, next) => {
  const allowed = process.env.CORS_ORIGIN || '*';
  if (allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const origins = allowed.split(',').map((o) => o.trim());
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Optional shared-secret gate. Set API_TOKEN on the backend and
// VITE_API_TOKEN (same value) at frontend build time to protect /api/*.
const API_TOKEN = process.env.API_TOKEN;
if (API_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    const token =
      (req.headers['x-api-token'] as string) ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token !== API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: missing or invalid API token' });
    }
    next();
  });
}

app.use('/api', (req: any, res, next) => {
  const wp = req.body?.workspacePath;
  if (typeof wp === 'string' && wp.length > 0) {
    const resolved = path.isAbsolute(wp) ? path.resolve(wp) : path.resolve(WORKSPACE_ROOT, wp);
    const rel = path.relative(WORKSPACE_ROOT, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(403).json({
        error: `Access denied: workspacePath escapes allowed root (${WORKSPACE_ROOT})`,
      });
    }
    req.body.workspacePath = resolved;
  }
  next();
});

// Settings, History and AI Usage local storage
const SETTINGS_FILE = path.join(process.cwd(), '.salama-settings.json');
const HISTORY_FILE = path.join(process.cwd(), '.salama-history.json');
const USAGE_FILE = path.join(process.cwd(), '.salama-usage.json');

// --- HEALTH & STATUS ---

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SalamaCode',
    phase: 3,
    platform: process.platform,
    time: new Date().toISOString(),
  });
});

// --- WORKSPACE & PRESETS ---

app.get('/api/workspace/presets', async (req, res) => {
  try {
    const workspacesDir = WORKSPACE_ROOT;
    await fs.mkdir(workspacesDir, { recursive: true });
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });

    const presets = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const full = path.join(workspacesDir, e.name);
        return {
          path: full,
          name: e.name,
          lastOpened: Date.now(),
        };
      });

    // Ensure TestApp exists for testing and validation
    const testAppPath = path.join(workspacesDir, 'TestApp');
    if (!presets.find((p) => p.name === 'TestApp')) {
      await fs.mkdir(testAppPath, { recursive: true });
      presets.push({
        path: testAppPath,
        name: 'TestApp',
        lastOpened: Date.now(),
      });
    }

    // Ensure C:\SalamaCodeTest simulation folder exists in workspaces
    const acceptancePath = path.join(workspacesDir, 'SalamaCodeTest');
    if (!presets.find((p) => p.name === 'SalamaCodeTest')) {
      await fs.mkdir(acceptancePath, { recursive: true });
      presets.push({
        path: acceptancePath,
        name: 'SalamaCodeTest',
        lastOpened: Date.now(),
      });
    }

    res.json(presets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/info', async (req, res) => {
  const { workspacePath } = req.body;
  if (!workspacePath) {
    return res.status(400).json({ error: 'workspacePath is required' });
  }

  try {
    const resolved = path.resolve(workspacePath);
    await fs.mkdir(resolved, { recursive: true });
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    res.json({
      path: resolved,
      name: path.basename(resolved) || resolved,
      lastOpened: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- FILESYSTEM APIS ---

app.post('/api/filesystem/list', async (req, res) => {
  const { workspacePath, relativeDir } = req.body;
  if (!workspacePath) {
    return res.status(400).json({ error: 'workspacePath is required' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeDir || '.');
  if (!guard.isValid) {
    return res.status(403).json({ error: guard.reason });
  }

  try {
    const nodes = await scanDirectory(workspacePath, relativeDir || '');
    res.json(nodes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/read', async (req, res) => {
  const { workspacePath, relativeFilePath, startLine, endLine } = req.body;
  if (!workspacePath || !relativeFilePath) {
    return res.status(400).json({ error: 'workspacePath and relativeFilePath are required' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeFilePath);
  if (!guard.isValid) {
    return res.status(403).json({ error: guard.reason });
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

    res.json({
      path: guard.resolvedPath,
      relativePath: guard.relativePath,
      content,
      size: stat.size,
      lineCount: lines.length,
      isBinary: false,
    });
  } catch (err: any) {
    res.status(404).json({ error: `File not found: ${err.message}` });
  }
});

app.post('/api/filesystem/write', async (req, res) => {
  const { workspacePath, relativeFilePath, content } = req.body;
  if (!workspacePath || !relativeFilePath || content === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeFilePath);
  if (!guard.isValid) {
    return res.status(403).json({ error: guard.reason });
  }

  try {
    // Create backup before writing
    const backup = await createBackup(workspacePath, relativeFilePath, 'write_file');

    const parentDir = path.dirname(guard.resolvedPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(guard.resolvedPath, content, 'utf-8');

    res.json({
      success: true,
      path: guard.resolvedPath,
      relativePath: guard.relativePath,
      backupPath: backup?.backupPath,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/create-directory', async (req, res) => {
  const { workspacePath, relativeDirPath } = req.body;
  if (!workspacePath || !relativeDirPath) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeDirPath);
  if (!guard.isValid) {
    return res.status(403).json({ error: guard.reason });
  }

  try {
    await fs.mkdir(guard.resolvedPath, { recursive: true });
    res.json({ success: true, path: guard.resolvedPath, relativePath: guard.relativePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/edit', async (req, res) => {
  const { workspacePath, relativeFilePath, content, oldText, newText } = req.body;
  if (!workspacePath || !relativeFilePath || content === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeFilePath);
  if (!guard.isValid) {
    return res.status(403).json({ error: guard.reason });
  }

  try {
    // Create backup before editing
    const backup = await createBackup(workspacePath, relativeFilePath, 'edit_file');
    let finalContent = content;

    if (oldText !== undefined && newText !== undefined) {
      const current = await fs.readFile(guard.resolvedPath, 'utf-8');
      if (!current.includes(oldText)) {
        return res.status(400).json({
          error: `Target text to replace was not found in ${relativeFilePath}`,
        });
      }
      finalContent = current.replace(oldText, newText);
    }

    await fs.writeFile(guard.resolvedPath, finalContent, 'utf-8');
    res.json({
      success: true,
      path: guard.resolvedPath,
      relativePath: guard.relativePath,
      backupPath: backup?.backupPath,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/search', async (req, res) => {
  const { workspacePath, query } = req.body;
  if (!workspacePath || !query) {
    return res.status(400).json({ error: 'workspacePath and query are required' });
  }

  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) return res.status(403).json({ error: guard.reason });

  try {
    const results = await searchInFiles(guard.resolvedPath, query);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/find', async (req, res) => {
  const { workspacePath, pattern } = req.body;
  if (!workspacePath || !pattern) {
    return res.status(400).json({ error: 'workspacePath and pattern are required' });
  }

  const guard = validateWorkspacePath(workspacePath, '.');
  if (!guard.isValid) return res.status(403).json({ error: guard.reason });

  try {
    const results = await findFilesByPattern(guard.resolvedPath, pattern);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/file-info', async (req, res) => {
  const { workspacePath, relativeFilePath } = req.body;
  if (!workspacePath || !relativeFilePath) {
    return res.status(400).json({ error: 'workspacePath and relativeFilePath are required' });
  }

  const guard = validateWorkspacePath(workspacePath, relativeFilePath);
  if (!guard.isValid) return res.status(403).json({ error: guard.reason });

  try {
    const stat = await fs.stat(guard.resolvedPath);
    let lines = 0;
    if (!stat.isDirectory()) {
      try {
        const content = await fs.readFile(guard.resolvedPath, 'utf-8');
        lines = content.split('\n').length;
      } catch {}
    }

    res.json({
      path: guard.resolvedPath,
      relativePath: guard.relativePath,
      size: stat.size,
      lines,
      isDirectory: stat.isDirectory(),
      extension: path.extname(guard.resolvedPath),
      modifiedAt: stat.mtimeMs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/backups', async (req, res) => {
  const { workspacePath } = req.body;
  if (!workspacePath) return res.status(400).json({ error: 'workspacePath is required' });
  try {
    const list = await listBackups(workspacePath);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/filesystem/rollback', async (req, res) => {
  const { workspacePath, backupId } = req.body;
  if (!workspacePath || !backupId) {
    return res.status(400).json({ error: 'workspacePath and backupId are required' });
  }
  try {
    const success = await restoreBackup(workspacePath, backupId);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- TERMINAL EXECUTION APIS ---

app.post('/api/terminal/run', async (req, res) => {
  const { workspacePath, command, options } = req.body;
  if (!workspacePath || !command) {
    return res.status(400).json({ error: 'workspacePath and command are required' });
  }

  if (process.env.ENABLE_TERMINAL !== 'true') {
    return res.status(403).json({
      error:
        'Terminal execution is disabled in web deployment. Set ENABLE_TERMINAL=true on the backend to enable (use with auth!).',
    });
  }

  try {
    const result = await executeTerminalCommand(workspacePath, command, options);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      command,
      exitCode: 1,
      stdout: '',
      stderr: err.message || 'Terminal execution error',
      durationMs: 0,
      error: err.message,
    });
  }
});

app.post('/api/terminal/kill', async (req, res) => {
  if (process.env.ENABLE_TERMINAL !== 'true') {
    return res.status(403).json({
      error:
        'Terminal execution is disabled in web deployment. Set ENABLE_TERMINAL=true on the backend to enable (use with auth!).',
    });
  }
  const { processId } = req.body;
  const killed = killRunningProcess(processId);
  res.json({ success: killed });
});

// --- GIT APIS (READ-ONLY) ---

app.post('/api/git/status', async (req, res) => {
  const { workspacePath } = req.body;
  if (!workspacePath) return res.status(400).json({ error: 'workspacePath is required' });
  try {
    const status = await getGitStatus(workspacePath);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/diff', async (req, res) => {
  const { workspacePath } = req.body;
  if (!workspacePath) return res.status(400).json({ error: 'workspacePath is required' });
  try {
    const diff = await getGitDiff(workspacePath);
    res.json({ diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/log', async (req, res) => {
  const { workspacePath, limit } = req.body;
  if (!workspacePath) return res.status(400).json({ error: 'workspacePath is required' });
  try {
    const commits = await getGitLog(workspacePath, limit || 10);
    res.json(commits);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS & HISTORY ---

app.get('/api/settings', async (req, res) => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json({
      aiProvider: 'gemini',
      theme: 'light',
      modelName: 'gemini-3.8-flash',
      reviewMode: 'ask',
      temperature: 0.3,
      maxTokens: 8192,
      maxAgentIterations: 30,
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
      openRouterModel: 'google/gemini-2.5-flash',
    });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    let current = {
      aiProvider: 'gemini',
      theme: 'light',
      modelName: 'gemini-3.8-flash',
      reviewMode: 'ask',
      temperature: 0.3,
      maxTokens: 8192,
      maxAgentIterations: 30,
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
      openRouterModel: 'google/gemini-2.5-flash',
    };
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      current = JSON.parse(data);
    } catch {}

    const updated = { ...current, ...req.body };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.post('/api/history', async (req, res) => {
  try {
    let list: any[] = [];
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      list = JSON.parse(data);
    } catch {}

    const item = req.body;
    list = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 50);
    await fs.writeFile(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- AI MODELS, TESTING & USAGE STATS ---

app.get('/api/ai/models', async (req, res) => {
  const { provider } = req.query;
  const p = (provider as string) || 'gemini';

  if (p === 'gemini') {
    return res.json({
      provider: 'gemini',
      models: [
        {
          id: 'gemini-3.8-flash',
          name: 'Gemini 3.8 Flash (Recommended)',
          provider: 'gemini',
          contextWindow: 1048576,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: true,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Free',
          estimatedCost: '$0.0000',
          status: 'Available',
          description: 'Next-generation ultra-fast multimodal model with native tool-calling.',
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          provider: 'gemini',
          contextWindow: 1048576,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: true,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Free',
          estimatedCost: '$0.0000',
          status: 'Available',
          description: 'Balanced speed and efficiency for coding and planning tasks.',
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          provider: 'gemini',
          contextWindow: 2097152,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: true,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Paid',
          estimatedCost: 'Estimated: $0.001 / 1k tokens',
          status: 'Available',
          description: 'Deep reasoning and complex multi-file architectural refactoring.',
        },
      ],
    });
  }

  if (p === 'openrouter') {
    return res.json({
      provider: 'openrouter',
      models: [
        {
          id: 'google/gemini-2.5-flash',
          name: 'Google: Gemini 2.5 Flash',
          provider: 'openrouter',
          contextWindow: 1000000,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: true,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Free',
          estimatedCost: 'Free / Community',
          status: 'Available',
          description: 'Fast, intelligent model with tool calling on OpenRouter.',
        },
        {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Anthropic: Claude 3.5 Sonnet',
          provider: 'openrouter',
          contextWindow: 200000,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: true,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Paid',
          estimatedCost: 'Estimated: $0.003 / 1k tokens',
          status: 'Available',
          description: 'Industry-leading code generation and reasoning benchmark champion.',
        },
        {
          id: 'meta-llama/llama-3.3-70b-instruct',
          name: 'Meta: Llama 3.3 70B Instruct',
          provider: 'openrouter',
          contextWindow: 128000,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: false,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Free',
          estimatedCost: 'Free tier available',
          status: 'Available',
          description: 'Open-weights powerhouse for code generation and debugging.',
        },
        {
          id: 'qwen/qwen-2.5-coder-32b-instruct',
          name: 'Qwen: 2.5 Coder 32B Instruct',
          provider: 'openrouter',
          contextWindow: 128000,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: false,
          supportsStructuredOutput: true,
          supportsLongContext: true,
          costType: 'Free',
          estimatedCost: 'Free tier available',
          status: 'Available',
          description: 'Specialized coding model with superior syntax accuracy.',
        },
      ],
    });
  }

  // Custom provider
  return res.json({
    provider: 'custom',
    models: [
      {
        id: 'custom-model',
        name: 'Custom Endpoint Model',
        provider: 'custom',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Unknown',
        estimatedCost: 'Custom Endpoint',
        status: 'Available',
        description: 'User-configured OpenAI-compatible endpoint.',
      },
    ],
  });
});

app.get('/api/ai/usage', async (req, res) => {
  try {
    const data = await fs.readFile(USAGE_FILE, 'utf-8');
    const logs = JSON.parse(data);
    const summary: Record<string, { totalRequests: number; successfulRequests: number; failedRequests: number; tokensUsed: number }> = {};

    for (const log of logs) {
      if (!summary[log.provider]) {
        summary[log.provider] = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, tokensUsed: 0 };
      }
      summary[log.provider].totalRequests++;
      if (log.status === 'SUCCESS') {
        summary[log.provider].successfulRequests++;
      } else {
        summary[log.provider].failedRequests++;
      }
      const tokens = (log.inputTokens || 0) + (log.outputTokens || 0);
      summary[log.provider].tokensUsed += tokens;
    }

    res.json({ logs: logs.slice(0, 100), ...summary });
  } catch {
    res.json({ logs: [], gemini: { totalRequests: 0, successfulRequests: 0, failedRequests: 0, tokensUsed: 0 } });
  }
});

app.post('/api/ai/usage/log', async (req, res) => {
  try {
    let logs: any[] = [];
    try {
      const data = await fs.readFile(USAGE_FILE, 'utf-8');
      logs = JSON.parse(data);
    } catch {}

    const item = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...req.body,
    };
    logs = [item, ...logs].slice(0, 500); // keep recent 500
    await fs.writeFile(USAGE_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/test-connection', async (req, res) => {
  const { provider, apiKey: customApiKey, model: customModel, baseUrl: customBaseUrl } = req.body;
  const currentProvider = provider || 'gemini';

  if (currentProvider === 'custom') {
    const apiKey = customApiKey || 'none';
    const baseUrl = customBaseUrl || 'http://localhost:11434/v1';
    const model = customModel || 'llama3';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: 'Respond with exactly: "SalamaCode Custom AI Connected Successfully"',
            },
          ],
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Connected';
      return res.json({ success: true, message: reply });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal menghubungi Custom Endpoint',
      });
    }
  }

  if (currentProvider === 'openrouter') {
    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'OPENROUTER_API_KEY tidak ditemukan. Harap masukkan API key di Settings.',
      });
    }

    const baseUrl = customBaseUrl || 'https://openrouter.ai/api/v1';
    const model = customModel || 'google/gemini-2.5-flash';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SalamaCode',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: 'Respond with exactly: "SalamaCode OpenRouter Connected Successfully"',
            },
          ],
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Connected';
      return res.json({ success: true, message: reply });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal menghubungi OpenRouter API',
      });
    }
  }

  // Default: Google Gemini
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'GEMINI_API_KEY tidak ditemukan. Harap konfigurasi GEMINI_API_KEY.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: customModel || 'gemini-3.8-flash',
      contents: 'Respond with exactly: "SalamaCode AI Connected Successfully"',
    });

    res.json({
      success: true,
      message: response.text || 'Connected',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal menghubungi Gemini API',
    });
  }
});

// --- TOOL DECLARATIONS & AGENT SYSTEM INSTRUCTION ---

const AGENT_SYSTEM_INSTRUCTION = `
You are SalamaCode, an advanced autonomous local AI Coding Agent designed for Windows desktop environments.
Created and powered by PT Salama Lantabura Int.

Workflow Paradigm:
USER GIVES ONE COMMAND -> AI PLANS -> AI WORKS -> AI TESTS -> AI FIXES -> AI COMPLETES

Core Capabilities & Autonomous Workflow:
1. When assigned a task:
   - First, analyze the workspace structure with 'list_files' or find files with 'find_files'.
   - Read necessary context files with 'read_file' (e.g., package.json, main components).
   - If looking for specific functions/identifiers, use 'search_files'.
   - Plan out the steps.
2. For writing and editing code:
   - Use 'write_file' to create new files or rewrite files.
   - Use 'edit_file' for targeted modifications. Provide complete, bug-free, clean code.
   - Use 'create_directory' to create subdirectories as needed.
3. For verifying and executing commands:
   - Use 'run_command' to run builds, tests, or installations (e.g., 'npm install', 'npm run build', 'node ...').
   - If an error occurs in the output:
     a. Read the error message carefully.
     b. Search or read the affected files.
     c. Fix the problem with 'edit_file' or 'write_file'.
     d. Re-run the command with 'run_command' to verify that the fix succeeded.
4. Git operations:
   - Use 'git_status', 'git_diff', and 'git_log' to inspect repository status safely.
   - You MUST NOT run destructive git commands like 'git reset --hard' or 'git push'.
5. Always stay strictly inside the workspace boundary. Never attempt path traversal.
6. Provide concise, polite, professional responses in the language used by the user (Indonesian or English).
`;

const FUNCTION_DECLARATIONS = [
  {
    name: 'list_files',
    description: 'Lists all files and directories in the workspace or in a specific subfolder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directory: {
          type: Type.STRING,
          description: 'Relative subfolder path (optional, empty for workspace root).',
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Reads the exact content of a file within the workspace with optional line range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Relative path of the file to read (e.g., package.json or src/App.tsx).',
        },
        startLine: {
          type: Type.INTEGER,
          description: 'Optional starting line (1-indexed).',
        },
        endLine: {
          type: Type.INTEGER,
          description: 'Optional ending line (inclusive).',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_file',
    description: 'Creates a new file or overwrites an existing file in the workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Relative path where the file should be created.',
        },
        content: {
          type: Type.STRING,
          description: 'Complete text content to write into the file.',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Modifies an existing file by replacing old text or saving updated content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Relative path to the file being edited.',
        },
        content: {
          type: Type.STRING,
          description: 'Complete new content or replacement content.',
        },
        oldText: {
          type: Type.STRING,
          description: 'Optional exact old text substring to replace.',
        },
        newText: {
          type: Type.STRING,
          description: 'Optional replacement text for oldText.',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Creates a new directory within the workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        directoryPath: {
          type: Type.STRING,
          description: 'Relative directory path to create (e.g. src/components).',
        },
      },
      required: ['directoryPath'],
    },
  },
  {
    name: 'search_files',
    description: 'Searches for a specific keyword or code string across all files in the project.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Text string or symbol name to search for.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_files',
    description: 'Finds files matching a glob pattern (e.g., *.tsx, *.php, *.blade.php, *.py, *.json).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: {
          type: Type.STRING,
          description: 'Pattern such as *.tsx, *.js, *.php, etc.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Retrieves metadata about a file (size, line count, modified time, extension).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Relative path to the file.',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'run_command',
    description: 'Executes a command inside the workspace directory in the local terminal.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: 'Shell command to execute (e.g., npm install, npm run build, node server.js).',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Retrieves the current git repository status (branch, modified, untracked, staged).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'git_diff',
    description: 'Retrieves the current uncommitted git diff of the workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'git_log',
    description: 'Retrieves recent git commit history (read-only).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'Maximum number of commits to retrieve (default 10).',
        },
      },
    },
  },
];

// OpenRouter tools schema conversion
const OPENROUTER_TOOLS = FUNCTION_DECLARATIONS.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, val]: [string, any]) => [
          key,
          {
            type: val.type === Type.INTEGER ? 'integer' : 'string',
            description: val.description,
          },
        ])
      ),
      required: (tool.parameters as any).required || [],
    },
  },
}));

// --- AI CHAT & AGENT ORCHESTRATION ---

app.post('/api/ai/chat', async (req, res) => {
  const {
    messages,
    workspacePath,
    customApiKey,
    modelName,
    provider,
    openRouterBaseUrl,
    openRouterModel,
    customBaseUrl,
    customModel,
    temperature = 0.3,
  } = req.body;

  const currentProvider = provider || 'gemini';

  const systemWithWorkspace = `${AGENT_SYSTEM_INSTRUCTION}
Active Workspace: "${workspacePath || 'No workspace selected'}"`;

  // === CUSTOM OPENAI-COMPATIBLE PROVIDER ===
  if (currentProvider === 'custom') {
    const apiKey = customApiKey || 'none';
    const baseUrl = customBaseUrl || 'http://localhost:11434/v1';
    const model = customModel || modelName || 'custom-model';

    try {
      const openAiMessages: any[] = [
        { role: 'system', content: systemWithWorkspace },
      ];

      for (const m of messages) {
        if (m.role === 'user') {
          openAiMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
          const assistantMsg: any = { role: 'assistant', content: m.content || '' };
          if (m.toolCalls && m.toolCalls.length > 0) {
            assistantMsg.tool_calls = m.toolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args || {}),
              },
            }));
          }
          openAiMessages.push(assistantMsg);

          if (m.toolResults && m.toolResults.length > 0) {
            for (const tr of m.toolResults) {
              openAiMessages.push({
                role: 'tool',
                tool_call_id: tr.toolCallId,
                name: tr.name,
                content: JSON.stringify(tr.success ? tr.data : { error: tr.error }),
              });
            }
          }
        }
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: openAiMessages,
          tools: OPENROUTER_TOOLS,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `Custom Provider Error (${response.status}): ${errorText}`,
          provider: 'custom',
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      const text = choice?.content || '';
      const rawToolCalls = choice?.tool_calls || [];

      const toolCalls = rawToolCalls.map((tc: any) => {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {}
        return {
          id: tc.id || `call_${Date.now()}`,
          name: tc.function.name,
          args: parsedArgs,
        };
      });

      return res.json({
        content: text,
        toolCalls,
        provider: 'custom',
      });
    } catch (err: any) {
      console.error('Custom Provider API Error:', err);
      return res.status(500).json({
        error: err.message || 'Terjadi kesalahan saat memproses permintaan endpoint kustom.',
        provider: 'custom',
      });
    }
  }

  // === OPENROUTER PROVIDER ===
  if (currentProvider === 'openrouter') {
    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'OPENROUTER_API_KEY tidak ditemukan. Harap masukkan API key di Settings.',
        provider: 'openrouter',
      });
    }

    const baseUrl = openRouterBaseUrl || 'https://openrouter.ai/api/v1';
    const model = openRouterModel || 'google/gemini-2.5-flash';

    try {
      const openRouterMessages: any[] = [
        { role: 'system', content: systemWithWorkspace },
      ];

      for (const m of messages) {
        if (m.role === 'user') {
          openRouterMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
          const assistantMsg: any = { role: 'assistant', content: m.content || '' };
          if (m.toolCalls && m.toolCalls.length > 0) {
            assistantMsg.tool_calls = m.toolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args || {}),
              },
            }));
          }
          openRouterMessages.push(assistantMsg);

          if (m.toolResults && m.toolResults.length > 0) {
            for (const tr of m.toolResults) {
              openRouterMessages.push({
                role: 'tool',
                tool_call_id: tr.toolCallId,
                name: tr.name,
                content: JSON.stringify(tr.success ? tr.data : { error: tr.error }),
              });
            }
          }
        }
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SalamaCode',
        },
        body: JSON.stringify({
          model,
          messages: openRouterMessages,
          tools: OPENROUTER_TOOLS,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isQuota = response.status === 429 || errorText.includes('quota');
        return res.status(response.status).json({
          error: `OpenRouter Error (${response.status}): ${errorText}`,
          isQuota,
          provider: 'openrouter',
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      const text = choice?.content || '';
      const rawToolCalls = choice?.tool_calls || [];

      const toolCalls = rawToolCalls.map((tc: any) => {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {}
        return {
          id: tc.id || `call_${Date.now()}`,
          name: tc.function.name,
          args: parsedArgs,
        };
      });

      return res.json({
        content: text,
        toolCalls,
        provider: 'openrouter',
      });
    } catch (err: any) {
      console.error('OpenRouter API Error:', err);
      return res.status(500).json({
        error: err.message || 'Terjadi kesalahan saat memproses permintaan OpenRouter.',
        provider: 'openrouter',
      });
    }
  }

  // === GOOGLE GEMINI PROVIDER (DEFAULT) ===
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY tidak ditemukan. Harap masukkan API key di Settings atau lingkungan.',
      provider: 'gemini',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const model = modelName || 'gemini-3.8-flash';

    // Format conversation history
    const formattedContents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        formattedContents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.args || {},
              },
            });
          }
        }
        if (parts.length > 0) {
          formattedContents.push({
            role: 'model',
            parts,
          });
        }

        if (msg.toolResults && msg.toolResults.length > 0) {
          const resultParts: any[] = [];
          for (const tr of msg.toolResults) {
            resultParts.push({
              functionResponse: {
                name: tr.name,
                response: tr.success ? { result: tr.data } : { error: tr.error },
              },
            });
          }
          formattedContents.push({
            role: 'user',
            parts: resultParts,
          });
        }
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: formattedContents,
      config: {
        systemInstruction: systemWithWorkspace,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS as any }],
        temperature,
      },
    });

    const text = response.text || '';
    const functionCalls = response.functionCalls || [];

    const toolCalls = functionCalls.map((fc, index) => ({
      id: `call_${Date.now()}_${index}`,
      name: fc.name,
      args: fc.args || {},
    }));

    res.json({
      content: text,
      toolCalls,
      provider: 'gemini',
    });
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    const isQuota =
      err.message?.includes('429') ||
      err.message?.toLowerCase().includes('quota') ||
      err.message?.toLowerCase().includes('rate limit');

    res.status(500).json({
      error: err.message || 'Terjadi kesalahan saat memproses permintaan AI.',
      isQuota,
      provider: 'gemini',
    });
  }
});

// --- SERVER INITIALIZATION & VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SalamaCode Fase 3 Server running on http://localhost:${PORT}`);
  });
}

startServer();
