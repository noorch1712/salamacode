import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Activity,
  FilePlus,
  FolderPlus,
  Terminal as TerminalIcon,
  GitBranch,
  RotateCcw,
  Play,
  CheckCircle2,
} from 'lucide-react';
import {
  WorkspaceInfo,
  FileNode,
  FileContent,
  ChatMessage,
  ActivityLogItem,
  PendingPermission,
  AppSettings,
  AgentState,
  TaskPlanItem,
  TerminalOutputLine,
  FallbackDecision,
  ProviderHealthStatus,
} from '../types/index.js';
import { desktopBridge } from '../services/api/desktopBridge.js';
import { AgentLoop } from '../services/agent/AgentLoop.js';
import { GeminiProvider } from '../services/ai/GeminiProvider.js';
import { OpenRouterProvider } from '../services/ai/OpenRouterProvider.js';
import { providerManager } from '../services/ai/ProviderManager.js';
import { ProjectService } from '../services/cloud/ProjectService.js';

import { Sidebar } from '../components/Sidebar.js';
import { FileExplorer } from '../components/FileExplorer.js';
import { CodeEditor } from '../components/CodeEditor.js';
import { AIChat } from '../components/AIChat.js';
import { ActivityLog } from '../components/ActivityLog.js';
import { PermissionDialog } from '../components/PermissionDialog.js';
import { FallbackDialog } from '../components/FallbackDialog.js';
import { TerminalPanel } from '../components/TerminalPanel.js';
import { CommandPalette } from '../components/CommandPalette.js';
import { GitPanel } from '../components/GitPanel.js';
import { BackupsPanel } from '../components/BackupsPanel.js';

interface WorkspaceProps {
  workspace: WorkspaceInfo;
  settings: AppSettings;
  onOpenFolderPicker: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  workspace,
  settings,
  onOpenFolderPicker,
  onOpenSettings,
  onOpenHistory,
  theme,
  onToggleTheme,
  onUpdateSettings,
}) => {
  // File Explorer State
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  // Layout Toggles
  const [showExplorer, setShowExplorer] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showBackupsPanel, setShowBackupsPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // AI & Agent State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>('IDLE');
  const [currentPlan, setCurrentPlan] = useState<TaskPlanItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalOutputLine[]>([]);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);

  // Permission Dialog State
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [permissionResolver, setPermissionResolver] = useState<((allowed: boolean) => void) | null>(null);

  // Fallback Dialog State
  const [fallbackDecision, setFallbackDecision] = useState<FallbackDecision | null>(null);
  const [fallbackResolver, setFallbackResolver] = useState<((allowed: boolean) => void) | null>(null);
  const [activeFallbackNotice, setActiveFallbackNotice] = useState<FallbackDecision | null>(null);
  const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealthStatus>>({
    gemini: 'HEALTHY',
    openrouter: 'HEALTHY',
    custom: 'HEALTHY',
  });

  // Active loop ref for cancellation
  const activeLoopRef = useRef<AgentLoop | null>(null);

  // Dialogs for manual file/folder creation
  const [newFileDialog, setNewFileDialog] = useState<{ open: boolean; parent?: string }>({
    open: false,
  });
  const [newFolderDialog, setNewFolderDialog] = useState<{ open: boolean; parent?: string }>({
    open: false,
  });
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  // Keyboard shortcut listener (Ctrl+P or Ctrl+K for command palette, Ctrl+` for terminal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowTerminal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch file list
  const refreshFiles = async () => {
    if (!workspace?.path) return;
    setIsLoadingFiles(true);
    try {
      const tree = await desktopBridge.listFiles(workspace.path);
      setFiles(tree);
    } catch (err) {
      console.error('Failed to list files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Poll provider health
  useEffect(() => {
    providerManager.getAllHealthStatuses().then(setProviderHealth).catch(() => {});
  }, [settings.aiProvider, workspace?.path]);

  // Auto-link workspace metadata to Supabase Cloud if user is authenticated
  useEffect(() => {
    if (workspace?.path && workspace?.name) {
      ProjectService.linkProject(workspace.path, workspace.name).catch(() => {});
    }
  }, [workspace?.path, workspace?.name]);

  // Load per-project settings if saved locally in workspace (.salama-project.json)
  useEffect(() => {
    if (!workspace?.path) return;
    desktopBridge
      .readFile(workspace.path, '.salama-project.json')
      .then((file) => {
        try {
          const parsed = JSON.parse(file.content);
          if (onUpdateSettings && (parsed.aiProvider || parsed.modelName || parsed.fallbackProvider)) {
            onUpdateSettings({
              ...(parsed.aiProvider ? { aiProvider: parsed.aiProvider } : {}),
              ...(parsed.modelName ? { modelName: parsed.modelName } : {}),
              ...(parsed.openRouterModel ? { openRouterModel: parsed.openRouterModel } : {}),
              ...(parsed.fallbackProvider ? { fallbackProvider: parsed.fallbackProvider } : {}),
            });
          }
        } catch {}
      })
      .catch(() => {
        // No local project config yet
      });
  }, [workspace?.path]);

  // Save per-project settings locally
  const saveProjectConfig = async (newCfg: Partial<AppSettings>) => {
    if (!workspace?.path) return;
    try {
      const projectConfig = {
        projectName: workspace.name,
        aiProvider: newCfg.aiProvider || settings.aiProvider,
        modelName: newCfg.modelName || settings.modelName,
        openRouterModel: newCfg.openRouterModel || settings.openRouterModel,
        fallbackProvider: newCfg.fallbackProvider || settings.fallbackProvider,
        updatedAt: new Date().toISOString(),
      };
      await desktopBridge.writeFile(
        workspace.path,
        '.salama-project.json',
        JSON.stringify(projectConfig, null, 2)
      );
    } catch {}
  };

  const handleUpdateSettings = (newCfg: Partial<AppSettings>) => {
    onUpdateSettings?.(newCfg);
    saveProjectConfig(newCfg);
  };

  useEffect(() => {
    refreshFiles();
    // Load initial welcome message
    setMessages([
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `Halo! Saya **SalamaCode AI Coding Agent (Fase 3: Multi-Provider AI & Smart Router)**.\n\nSaya mendukung Google Gemini, OpenRouter, dan Local Custom LLM dengan Smart Routing & Auto-Fallback otomatis. Saya dapat membaca project di folder **${workspace.name}**, menganalisis struktur file, mengeksekusi terminal command, dan mengedit file secara aman dengan persetujuan Anda.\n\nApa yang ingin Anda bangun hari ini?`,
        timestamp: Date.now(),
      },
    ]);
  }, [workspace.path]);

  // Open a file
  const handleSelectFile = async (node: FileNode) => {
    if (node.isDirectory) return;
    handleOpenFileByPath(node.relativePath);
  };

  const handleOpenFileByPath = async (relativePath: string) => {
    setIsLoadingFileContent(true);
    try {
      const fileData = await desktopBridge.readFile(workspace.path, relativePath);
      setActiveFile(fileData);
      setShowEditor(true);
    } catch (err: any) {
      console.error(`Failed to read file ${relativePath}:`, err);
      alert(`Gagal membuka file: ${err.message}`);
    } finally {
      setIsLoadingFileContent(false);
    }
  };

  // Save modified file manually
  const handleSaveFile = async (newContent: string) => {
    if (!activeFile) return;
    await desktopBridge.writeFile(workspace.path, activeFile.relativePath, newContent);
    setActiveFile({
      ...activeFile,
      content: newContent,
    });
    setActivityLogs((prev) => [
      {
        id: `act_${Date.now()}_save`,
        title: `✓ File disimpan: ${activeFile.relativePath}`,
        status: 'success',
        timestamp: Date.now(),
      },
      ...prev,
    ]);
    refreshFiles();
  };

  // Create new file manually
  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const targetPath = newFileDialog.parent
      ? `${newFileDialog.parent}/${newFileName.trim()}`
      : newFileName.trim();

    try {
      await desktopBridge.writeFile(workspace.path, targetPath, '');
      setNewFileDialog({ open: false });
      setNewFileName('');
      await refreshFiles();
      await handleOpenFileByPath(targetPath);
    } catch (err: any) {
      alert(`Gagal membuat file: ${err.message}`);
    }
  };

  // Create new folder manually
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const targetPath = newFolderDialog.parent
      ? `${newFolderDialog.parent}/${newFolderName.trim()}`
      : newFolderName.trim();

    try {
      await desktopBridge.createDirectory(workspace.path, targetPath);
      setNewFolderDialog({ open: false });
      setNewFolderName('');
      await refreshFiles();
    } catch (err: any) {
      alert(`Gagal membuat folder: ${err.message}`);
    }
  };

  // Permission System callbacks
  const requestPermission = (perm: PendingPermission): Promise<boolean> => {
    // If user configured reviewMode = 'auto' and tool is SAFE, auto-approve
    if (settings.reviewMode === 'auto' && perm.securityLevel !== 'APPROVAL_REQUIRED') {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      setPendingPermission(perm);
      setPermissionResolver(() => resolve);
    });
  };

  const handleAllowPermission = () => {
    if (permissionResolver) {
      permissionResolver(true);
    }
    setPendingPermission(null);
    setPermissionResolver(null);
  };

  const handleRejectPermission = () => {
    if (permissionResolver) {
      permissionResolver(false);
    }
    setPendingPermission(null);
    setPermissionResolver(null);
  };

  const askFallbackPermission = (decision: FallbackDecision): Promise<boolean> => {
    return new Promise((resolve) => {
      setFallbackDecision(decision);
      setFallbackResolver(() => resolve);
    });
  };

  const handleConfirmFallback = () => {
    if (fallbackResolver) {
      fallbackResolver(true);
    }
    setFallbackDecision(null);
    setFallbackResolver(null);
  };

  const handleCancelFallback = () => {
    if (fallbackResolver) {
      fallbackResolver(false);
    }
    setFallbackDecision(null);
    setFallbackResolver(null);
  };

  // Stop the running agent loop
  const handleStopAgent = () => {
    if (activeLoopRef.current) {
      activeLoopRef.current.stop();
      setAgentState('STOPPED');
      setTerminalLines((prev) => [
        ...prev,
        {
          id: `line_${Date.now()}`,
          text: '[System] Eksekusi Agent dihentikan oleh pengguna.',
          type: 'system',
          timestamp: Date.now(),
        },
      ]);
    }
    setIsAgentRunning(false);
  };

  // Execute Agent Loop when user sends a prompt
  const handleSendMessage = async (prompt: string) => {
    if (isAgentRunning) return;
    setIsAgentRunning(true);
    setAgentState('ANALYZING');

    const loop = new AgentLoop({
      workspacePath: workspace.path,
      settings,
      onActivity: (item) => {
        setActivityLogs((prev) => [item, ...prev]);
      },
      onRequestPermission: requestPermission,
      onAskFallbackPermission: askFallbackPermission,
      onFallbackNotice: (decision) => {
        setActiveFallbackNotice(decision);
        const nextP = decision.nextProvider as 'gemini' | 'openrouter' | 'custom';
        const update = {
          aiProvider: nextP,
          ...(nextP === 'gemini'
            ? { modelName: decision.model }
            : nextP === 'openrouter'
            ? { openRouterModel: decision.model }
            : { customProviderModel: decision.model }),
        };
        handleUpdateSettings(update);
      },
      onStateChange: (state) => {
        setAgentState(state);
      },
      onPlanUpdate: (plan) => {
        setCurrentPlan(plan);
      },
      onTerminalOutput: (line) => {
        setTerminalLines((prev) => [...prev, line]);
        setShowTerminal(true);
      },
      onFilesChanged: () => {
        refreshFiles();
        if (activeFile) {
          handleOpenFileByPath(activeFile.relativePath);
        }
      },
    });

    activeLoopRef.current = loop;

    try {
      const result = await loop.run(messages, prompt);
      setMessages(result.updatedHistory);

      // Record to Project History
      await desktopBridge.saveHistory({
        id: `hist_${Date.now()}`,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        timestamp: Date.now(),
        title: prompt.slice(0, 45) + (prompt.length > 45 ? '...' : ''),
        messageCount: result.updatedHistory.length,
      });
    } catch (err: any) {
      console.error('Agent loop failure:', err);
      setAgentState('ERROR');
    } finally {
      setIsAgentRunning(false);
      activeLoopRef.current = null;
      refreshFiles();
    }
  };

  // Run a manual command in terminal
  const handleRunCustomCommand = async (cmd: string) => {
    setIsTerminalRunning(true);
    setShowTerminal(true);
    setTerminalLines((prev) => [
      ...prev,
      {
        id: `cmd_${Date.now()}`,
        text: `$ ${cmd}`,
        type: 'cmd',
        timestamp: Date.now(),
      },
    ]);

    try {
      const res = await desktopBridge.runCommand(workspace.path, cmd);
      if (res.stdout) {
        setTerminalLines((prev) => [
          ...prev,
          {
            id: `stdout_${Date.now()}`,
            text: res.stdout,
            type: 'stdout',
            timestamp: Date.now(),
          },
        ]);
      }
      if (res.stderr) {
        setTerminalLines((prev) => [
          ...prev,
          {
            id: `stderr_${Date.now()}`,
            text: res.stderr,
            type: 'stderr',
            timestamp: Date.now(),
          },
        ]);
      }
      setTerminalLines((prev) => [
        ...prev,
        {
          id: `status_${Date.now()}`,
          text: `[Process exited with code ${res.exitCode}] (Durasi: ${res.durationMs}ms)`,
          type: 'system',
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      setTerminalLines((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          text: `[Error executing command]: ${err.message}`,
          type: 'stderr',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTerminalRunning(false);
    }
  };

  // Built-in Final Acceptance Test
  const handleRunAcceptanceTest = async () => {
    const prompt =
      'Buatkan project Node.js mini dengan file math.js (fungsi add, subtract, multiply) dan file test.js sederhana yang menguji fungsi math tersebut. Kemudian jalankan command "node test.js" via terminal untuk memverifikasi hasilnya.';
    handleSendMessage(prompt);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans select-none">
      {/* Top Bar */}
      <Sidebar
        workspace={workspace}
        onOpenFolderPicker={onOpenFolderPicker}
        onOpenSettings={onOpenSettings}
        onOpenHistory={onOpenHistory}
        onOpenGit={() => {
          setShowGitPanel(true);
          setShowBackupsPanel(false);
        }}
        onOpenBackups={() => {
          setShowBackupsPanel(true);
          setShowGitPanel(false);
        }}
        onToggleTerminal={() => setShowTerminal((prev) => !prev)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isAgentRunning={isAgentRunning}
        settings={settings}
        providerHealth={providerHealth}
        fallbackNotice={activeFallbackNotice}
      />

      {/* Main 3-Column IDE Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Column: Project File Explorer */}
        {showExplorer && (
          <div className="w-64 min-w-52 max-w-80 shrink-0 h-full flex flex-col">
            <FileExplorer
              files={files}
              activeFilePath={activeFile?.relativePath || null}
              onSelectFile={handleSelectFile}
              onRefresh={refreshFiles}
              onCreateFile={(parent) => setNewFileDialog({ open: true, parent })}
              onCreateFolder={(parent) => setNewFolderDialog({ open: true, parent })}
              isLoading={isLoadingFiles}
            />
          </div>
        )}

        {/* Center Column: AI Chat / Agent & Terminal */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-slate-900 relative">
          {/* Layout control bar */}
          <div className="h-7 px-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExplorer(!showExplorer)}
                className="p-1 hover:text-slate-800 dark:hover:text-slate-200 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title={showExplorer ? 'Sembunyikan File Explorer' : 'Tampilkan File Explorer'}
              >
                {showExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                AI Coding Agent Workspace
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Acceptance test runner shortcut */}
              <button
                onClick={handleRunAcceptanceTest}
                disabled={isAgentRunning}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium transition"
                title="Jalankan Final Acceptance Test Otomatis"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test Flow</span>
              </button>

              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  showTerminal
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Buka / Tutup Terminal"
              >
                <TerminalIcon className="w-3 h-3" />
                <span>Terminal {terminalLines.length > 0 && `(${terminalLines.length})`}</span>
              </button>

              <button
                onClick={() => setShowActivityDrawer(!showActivityDrawer)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  showActivityDrawer
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Tampilkan/Sembunyikan Activity Log"
              >
                <Activity className="w-3 h-3" />
                <span>Activity ({activityLogs.length})</span>
              </button>

              <button
                onClick={() => setShowEditor(!showEditor)}
                className="p-1 hover:text-slate-800 dark:hover:text-slate-200 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title={showEditor ? 'Sembunyikan Code Editor' : 'Tampilkan Code Editor'}
              >
                {showEditor ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* AI Chat Component */}
          <div className="flex-1 min-h-0">
            <AIChat
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isAgentRunning}
              agentState={agentState}
              onStopAgent={handleStopAgent}
              onClearChat={handleClearChat}
              onOpenFileByPath={handleOpenFileByPath}
              currentPlan={currentPlan}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              fallbackNotice={activeFallbackNotice}
              providerHealth={providerHealth}
            />
          </div>

          {/* Collapsible Terminal Panel at bottom */}
          {showTerminal && (
            <TerminalPanel
              workspacePath={workspace.path}
              outputLines={terminalLines}
              onClearOutput={() => setTerminalLines([])}
              isRunning={isTerminalRunning}
              onClose={() => setShowTerminal(false)}
              onRunCustomCommand={handleRunCustomCommand}
            />
          )}

          {/* Collapsible Activity Log Drawer */}
          {showActivityDrawer && (
            <div className="absolute right-3 top-10 bottom-24 w-80 z-20 shadow-xl animate-in slide-in-from-right-5 duration-150">
              <ActivityLog
                items={activityLogs}
                onClear={() => setActivityLogs([])}
              />
            </div>
          )}
        </div>

        {/* Right Column: Code Editor OR Git Panel OR Backups Panel */}
        {showGitPanel ? (
          <div className="w-2/5 min-w-72 max-w-2xl shrink-0 h-full flex flex-col">
            <GitPanel
              workspacePath={workspace.path}
              onClose={() => setShowGitPanel(false)}
              onOpenFile={handleOpenFileByPath}
            />
          </div>
        ) : showBackupsPanel ? (
          <div className="w-2/5 min-w-72 max-w-2xl shrink-0 h-full flex flex-col">
            <BackupsPanel
              workspacePath={workspace.path}
              onClose={() => setShowBackupsPanel(false)}
              onFilesChanged={refreshFiles}
            />
          </div>
        ) : showEditor ? (
          <div className="w-2/5 min-w-72 max-w-2xl shrink-0 h-full flex flex-col">
            <CodeEditor
              file={activeFile}
              onSave={handleSaveFile}
              isLoading={isLoadingFileContent}
            />
          </div>
        ) : null}
      </div>

      {/* Bottom Workspace Status Bar */}
      <footer className="h-7 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0 select-none z-10">
        <div className="flex items-center gap-2 truncate mr-4">
          <FolderOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Workspace:</span>
          <span className="font-mono text-slate-600 dark:text-slate-400 truncate" title={workspace.path}>
            {workspace.path}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span className="text-slate-400">
            Created &amp; Powered by <strong className="text-slate-700 dark:text-slate-300">PT Salama Lantabura Int.</strong>
          </span>
        </div>
      </footer>

      {/* Permission Approval Dialog Modal */}
      <PermissionDialog
        permission={pendingPermission}
        onAllow={handleAllowPermission}
        onReject={handleRejectPermission}
      />

      {/* Smart Fallback Confirmation Dialog Modal */}
      <FallbackDialog
        decision={fallbackDecision}
        onConfirm={handleConfirmFallback}
        onCancel={handleCancelFallback}
      />

      {/* Command Palette (Ctrl+P) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        files={files}
        onOpenFile={handleOpenFileByPath}
        onOpenTerminal={() => setShowTerminal(true)}
        onOpenSettings={onOpenSettings}
        onOpenGit={() => {
          setShowGitPanel(true);
          setShowBackupsPanel(false);
        }}
        onOpenBackups={() => {
          setShowBackupsPanel(true);
          setShowGitPanel(false);
        }}
        onToggleTheme={onToggleTheme}
        onOpenFolderPicker={onOpenFolderPicker}
        onRunTestApp={handleRunAcceptanceTest}
        theme={theme}
      />

      {/* New File Dialog */}
      {newFileDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateFileSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm mb-3">
              <FilePlus className="w-4 h-4 text-blue-600" />
              <span>Buat File Baru</span>
            </div>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Contoh: hello.txt atau src/pages/Login.tsx"
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl outline-hidden focus:border-blue-500 font-mono"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setNewFileDialog({ open: false })}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200"
              >
                Buat File
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Folder Dialog */}
      {newFolderDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateFolderSubmit}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 max-w-sm w-full"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm mb-3">
              <FolderPlus className="w-4 h-4 text-blue-600" />
              <span>Buat Folder Baru</span>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Contoh: components atau utils"
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl outline-hidden focus:border-blue-500 font-mono"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setNewFolderDialog({ open: false })}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-200"
              >
                Buat Folder
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
