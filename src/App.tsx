/**
 * App.tsx
 * SalamaCode Application Root
 * Integrates Fase 4 Cloud Sync, Multi-Device, User Management, and Workspace IDE.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  LayoutDashboard,
  FolderKanban,
  Code2,
  Laptop,
  BarChart3,
  ShieldAlert,
  Settings as SettingsIcon,
  History,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  User,
  LogOut,
  ChevronDown,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { Welcome } from './pages/Welcome.js';
import { Workspace } from './pages/Workspace.js';
import { Settings } from './pages/Settings.js';
import { Dashboard } from './pages/Dashboard.js';
import { Projects } from './pages/Projects.js';
import { Devices } from './pages/Devices.js';
import { Usage } from './pages/Usage.js';
import { Admin } from './pages/Admin.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { HistoryModal } from './components/HistoryModal.js';
import { AppSettings, ProjectHistoryItem, WorkspaceInfo, UserProfile } from './types/index.js';
import { desktopBridge } from './services/api/desktopBridge.js';
import { AuthService } from './services/auth/AuthService.js';
import { SyncService } from './services/cloud/SyncService.js';

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<
    'workspace' | 'dashboard' | 'projects' | 'devices' | 'usage' | 'admin' | 'login' | 'register'
  >('dashboard');

  // Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem('salamacode_offline_mode') === 'true';
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Workspace & Settings State
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'gemini',
    theme: 'light',
    modelName: 'gemini-3.8-flash',
  });
  const [history, setHistory] = useState<ProjectHistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Cloud Sync State
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);

  // 1. Initialize Auth and App
  useEffect(() => {
    async function init() {
      try {
        setIsCheckingAuth(true);

        // Check active session
        const authState = await AuthService.initSession();
        if (authState.user) {
          setCurrentUser(authState.user);
          setIsOfflineMode(false);
        } else if (!isOfflineMode) {
          // If no session and user hasn't chosen offline mode, prompt login
          setCurrentView('login');
        }

        // Load local app settings & presets
        const storedSettings = await desktopBridge.getSettings();
        setSettings(storedSettings);

        const storedHistory = await desktopBridge.getHistory();
        setHistory(storedHistory);

        const presets = await desktopBridge.listPresetWorkspaces();
        setRecentWorkspaces(presets);

        // Restore last workspace if available
        if (storedSettings.lastWorkspacePath) {
          try {
            const wsInfo = await desktopBridge.getWorkspaceInfo(storedSettings.lastWorkspacePath);
            setWorkspace(wsInfo);
          } catch {
            // Non-critical if path moved
          }
        }

        setSyncQueueCount(SyncService.getQueueLength());
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    }
    init();

    // Listen for auth state changes
    const unsubAuth = AuthService.onAuthStateChange((state) => {
      setCurrentUser(state.user);
      if (state.user) {
        setIsOfflineMode(false);
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const handleSelectWorkspace = async (targetPath: string) => {
    try {
      const info = await desktopBridge.getWorkspaceInfo(targetPath);
      setWorkspace(info);
      const updated = await desktopBridge.saveSettings({ lastWorkspacePath: info.path });
      setSettings(updated);
      setCurrentView('workspace');
    } catch (err: any) {
      alert(`Gagal membuka workspace: ${err.message}`);
    }
  };

  const handleChooseNativeFolder = async () => {
    try {
      const selectedPath = await desktopBridge.chooseDirectory();
      if (selectedPath) {
        await handleSelectWorkspace(selectedPath);
      }
    } catch (err: any) {
      alert(`Gagal memilih folder: ${err.message}`);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await desktopBridge.saveSettings(newSettings);
    setSettings(updated);
  };

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    handleSaveSettings({ theme: nextTheme });
  };

  const handleContinueOffline = () => {
    setIsOfflineMode(true);
    localStorage.setItem('salamacode_offline_mode', 'true');
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
    setShowUserDropdown(false);
    setCurrentView('login');
  };

  // If viewing Auth screens (Login / Register)
  if (currentView === 'login') {
    return (
      <div className={settings.theme === 'dark' ? 'dark' : ''}>
        <Login
          onSuccess={(u) => {
            setCurrentUser(u);
            setIsOfflineMode(false);
            localStorage.removeItem('salamacode_offline_mode');
            setCurrentView('dashboard');
          }}
          onNavigateRegister={() => setCurrentView('register')}
          onContinueOffline={handleContinueOffline}
        />
      </div>
    );
  }

  if (currentView === 'register') {
    return (
      <div className={settings.theme === 'dark' ? 'dark' : ''}>
        <Register
          onSuccess={(u) => {
            setCurrentUser(u);
            setIsOfflineMode(false);
            localStorage.removeItem('salamacode_offline_mode');
            setCurrentView('dashboard');
          }}
          onNavigateLogin={() => setCurrentView('login')}
          onContinueOffline={handleContinueOffline}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-slate-100 ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Top Application Header / Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-2xs z-30">
        {/* Left: Brand & View Navigation */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                SalamaCode
              </div>
              <div className="text-[10px] text-blue-600 font-semibold leading-tight mt-0.5">
                v0.4.0 • Cloud Sync
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentView('workspace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'workspace'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Workspace</span>
              {workspace && (
                <span className="max-w-[120px] truncate text-[10px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                  {workspace.name}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'projects'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Projects</span>
            </button>

            <button
              onClick={() => setCurrentView('devices')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'devices'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Devices</span>
            </button>

            <button
              onClick={() => setCurrentView('usage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'usage'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Usage</span>
            </button>

            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
              <button
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-rose-50 text-rose-700'
                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right: Cloud Sync, Utility Tools, and User Profile */}
        <div className="flex items-center gap-3">
          {/* Cloud Sync Indicator (Requirement 22, 23, 24, 25) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600">
            {currentUser && !isOfflineMode ? (
              syncQueueCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Syncing ({syncQueueCount})</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-700">Cloud Synced</span>
                </>
              )
            ) : (
              <>
                <CloudOff className="w-3 h-3 text-slate-400" />
                <span className="text-slate-500">Offline Mode</span>
              </>
            )}
          </div>

          {/* History */}
          <button
            onClick={() => setShowHistory(true)}
            title="Riwayat Project"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            title={settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings Modal */}
          <button
            onClick={() => setShowSettings(true)}
            title="Pengaturan AI &amp; Akun"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* User Profile Dropdown */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown((prev) => !prev)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  {currentUser.fullName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="font-bold text-xs text-slate-800 leading-tight">
                    {currentUser.displayName || currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-blue-600 font-semibold uppercase leading-tight">
                    Plan: {currentUser.planId}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="font-bold text-slate-900">{currentUser.fullName}</div>
                    <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowSettings(true);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Akun &amp; Profil</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setCurrentView('devices');
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      <span>Perangkat Anda</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('login')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              Masuk / Login
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-auto">
        {currentView === 'dashboard' && (
          <div className="p-6 max-w-7xl mx-auto">
            <Dashboard
              user={currentUser}
              onOpenWorkspacePath={handleSelectWorkspace}
              onNavigateTab={(tab) => setCurrentView(tab as any)}
              onOpenFolderPicker={handleChooseNativeFolder}
            />
          </div>
        )}

        {currentView === 'workspace' && (
          <div className="h-[calc(100vh-3.5rem)]">
            {!workspace ? (
              <Welcome
                onSelectWorkspace={handleSelectWorkspace}
                recentWorkspaces={recentWorkspaces}
                onOpenNativeFolderPicker={handleChooseNativeFolder}
                isElectron={desktopBridge.isElectron}
              />
            ) : (
              <Workspace
                workspace={workspace}
                onOpenFolderPicker={handleChooseNativeFolder}
                onOpenSettings={() => setShowSettings(true)}
                onOpenHistory={() => setShowHistory(true)}
                settings={settings}
                onUpdateSettings={handleSaveSettings}
                theme={settings.theme || 'light'}
                onToggleTheme={toggleTheme}
              />
            )}
          </div>
        )}

        {currentView === 'projects' && (
          <div className="p-6 max-w-7xl mx-auto">
            <Projects
              onOpenWorkspacePath={handleSelectWorkspace}
              onOpenFolderPicker={handleChooseNativeFolder}
              currentWorkspacePath={workspace?.path}
            />
          </div>
        )}

        {currentView === 'devices' && (
          <div className="p-6 max-w-5xl mx-auto">
            <Devices />
          </div>
        )}

        {currentView === 'usage' && (
          <div className="p-6 max-w-5xl mx-auto">
            <Usage />
          </div>
        )}

        {currentView === 'admin' && (
          <div className="p-6 max-w-7xl mx-auto">
            <Admin />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          lastWorkspacePath={workspace?.path}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
