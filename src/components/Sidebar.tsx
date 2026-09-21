import React from 'react';
import {
  FolderOpen,
  Settings as SettingsIcon,
  Sparkles,
  History,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  GitBranch,
  RotateCcw,
  Search,
  Sun,
  Moon,
  Cpu,
} from 'lucide-react';
import {
  AppSettings,
  FallbackDecision,
  ProviderHealthStatus,
  WorkspaceInfo,
} from '../types/index.js';

interface SidebarProps {
  workspace: WorkspaceInfo | null;
  onOpenFolderPicker: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenGit: () => void;
  onOpenBackups: () => void;
  onToggleTerminal: () => void;
  onOpenCommandPalette: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isAgentRunning?: boolean;
  settings?: AppSettings;
  providerHealth?: Record<string, ProviderHealthStatus>;
  fallbackNotice?: FallbackDecision | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspace,
  onOpenFolderPicker,
  onOpenSettings,
  onOpenHistory,
  onOpenGit,
  onOpenBackups,
  onToggleTerminal,
  onOpenCommandPalette,
  theme,
  onToggleTheme,
  isAgentRunning,
  settings,
  providerHealth,
  fallbackNotice,
}) => {
  const activeProvider = settings?.aiProvider || 'gemini';
  const currentHealth = providerHealth?.[activeProvider] || 'HEALTHY';
  const isLimited = currentHealth === 'LIMITED' || Boolean(fallbackNotice);
  const isError = currentHealth === 'ERROR';

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between select-none shrink-0 shadow-xs z-10">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shadow-xs shadow-blue-500/30">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
              SalamaCode
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
              Fase 3 Multi-Provider
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            AI Coding Agent • PT Salama Lantabura Int.
          </span>
        </div>
      </div>

      {/* Quick Search / Command Palette shortcut in header */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs transition cursor-pointer"
        title="Buka Command Palette (Ctrl+P)"
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <span>Cari file atau aksi...</span>
        <kbd className="text-[10px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-500 dark:text-slate-400">
          Ctrl+P
        </kbd>
      </button>

      {/* Project AI Status Badge (Requirement 36) */}
      <div className="hidden xl:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs" title="Project AI & Provider Status">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">AI:</span>
          {isLimited ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Limited
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Unavailable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ready
            </span>
          )}
        </div>
        <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="font-semibold capitalize">
            {activeProvider === 'gemini'
              ? 'Gemini'
              : activeProvider === 'openrouter'
              ? 'OpenRouter'
              : 'Custom'}
          </span>
          <span className="text-slate-400 truncate max-w-[120px]">
            {activeProvider === 'gemini'
              ? settings?.modelName || 'gemini-3.8-flash'
              : activeProvider === 'openrouter'
              ? settings?.openRouterModel || 'gemini-2.5-flash'
              : settings?.customProviderModel || 'custom'}
          </span>
          {fallbackNotice && (
            <span className="text-amber-600 dark:text-amber-400 text-[10px] bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 ml-1">
              Fallback: {fallbackNotice.nextProvider}
            </span>
          )}
        </div>
      </div>

      {/* Active Workspace Info Badge */}
      <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg max-w-xs">
        <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
        <div className="text-xs truncate">
          <span className="text-slate-400 font-normal">Workspace: </span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {workspace ? workspace.name : 'Belum dipilih'}
          </span>
        </div>
        {isAgentRunning ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 ml-auto shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Agent Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded ml-auto shrink-0">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Siap
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleTerminal}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Buka / Tutup Terminal"
        >
          <Terminal className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Terminal</span>
        </button>

        <button
          onClick={onOpenGit}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-amber-700 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Source Control & Git"
        >
          <GitBranch className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Git</span>
        </button>

        <button
          onClick={onOpenBackups}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-purple-700 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Backup & Rollback"
        >
          <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">Backups</span>
        </button>

        <button
          id="btn-choose-folder-top"
          onClick={onOpenFolderPicker}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Ganti folder project workspace"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Folder</span>
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title={`Ganti tema ke ${theme === 'dark' ? 'Light' : 'Dark'}`}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          title="Pengaturan Aplikasi"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
