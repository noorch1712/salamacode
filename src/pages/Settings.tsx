import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Sun,
  Moon,
  Save,
  Loader2,
  Shield,
  Layers,
  Sliders,
  Terminal,
  Globe,
  ArrowUpDown,
  RotateCcw,
  Download,
  Upload,
  BarChart3,
  ListFilter,
  Eye,
  EyeOff,
  Cpu,
  Network,
  Zap,
  User,
  Cloud,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  AIProviderType,
  AppSettings,
  ProviderHealthStatus,
  AIUsageSummary,
  AITelemetryLog,
  UserProfile,
} from '../types/index.js';
import { desktopBridge } from '../services/api/desktopBridge.js';
import { providerManager } from '../services/ai/ProviderManager.js';
import { AuthService } from '../services/auth/AuthService.js';
import { ProfileService, DEFAULT_PLANS } from '../services/auth/ProfileService.js';
import { SyncService } from '../services/cloud/SyncService.js';

interface SettingsProps {
  settings: AppSettings;
  onSave: (newSettings: Partial<AppSettings>) => Promise<void>;
  onClose: () => void;
  lastWorkspacePath?: string;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSave,
  onClose,
  lastWorkspacePath,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'account' | 'providers' | 'routing' | 'cloud' | 'usage' | 'general'
  >('providers');

  // Account & Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(
    AuthService.getCurrentState().user
  );
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editDisplayName, setEditDisplayName] = useState(currentUser?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Account Deletion 2-Step
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Cloud & Privacy State
  const [syncProjectMetadata, setSyncProjectMetadata] = useState(
    settings.syncProjectMetadata ?? true
  );
  const [syncConversationMetadata, setSyncConversationMetadata] = useState(
    settings.syncConversationMetadata ?? false
  );
  const [sendAnonymousDiagnostics, setSendAnonymousDiagnostics] = useState(
    settings.sendAnonymousDiagnostics ?? true
  );
  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);

  useEffect(() => {
    setOfflineQueueLength(SyncService.getQueueLength());
  }, [activeTab]);

  // Active Provider
  const [provider, setProvider] = useState<AIProviderType>(settings.aiProvider || 'gemini');

  // Gemini fields
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [modelName, setModelName] = useState(settings.modelName || 'gemini-3.8-flash');

  // OpenRouter fields
  const [openRouterApiKey, setOpenRouterApiKey] = useState(settings.openRouterApiKey || '');
  const [openRouterBaseUrl, setOpenRouterBaseUrl] = useState(
    settings.openRouterBaseUrl || 'https://openrouter.ai/api/v1'
  );
  const [openRouterModel, setOpenRouterModel] = useState(
    settings.openRouterModel || 'google/gemini-2.5-flash'
  );

  // Custom Provider fields
  const [enableCustomProvider, setEnableCustomProvider] = useState(
    settings.enableCustomProvider || false
  );
  const [customProviderName, setCustomProviderName] = useState(
    settings.customProviderName || 'Local Ollama / LM Studio'
  );
  const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState(
    settings.customProviderBaseUrl || 'http://localhost:11434/v1'
  );
  const [customProviderApiKey, setCustomProviderApiKey] = useState(
    settings.customProviderApiKey || ''
  );
  const [customProviderModel, setCustomProviderModel] = useState(
    settings.customProviderModel || 'llama3:8b'
  );

  // Routing & Fallback
  const [providerPriority, setProviderPriority] = useState<AIProviderType[]>(
    settings.providerPriority || ['gemini', 'openrouter', 'custom']
  );
  const [fallbackProvider, setFallbackProvider] = useState<AIProviderType>(
    settings.fallbackProvider || 'openrouter'
  );
  const [autoFallback, setAutoFallback] = useState<boolean>(settings.autoFallback ?? true);
  const [askBeforeFallback, setAskBeforeFallback] = useState<boolean>(
    settings.askBeforeFallback ?? true
  );
  const [aiSafetyMode, setAiSafetyMode] = useState<'Safe' | 'Balanced' | 'Auto'>(
    settings.safetyMode || settings.aiSafetyMode || 'Balanced'
  );

  // General & Execution
  const [reviewMode, setReviewMode] = useState<'ask' | 'auto'>(settings.reviewMode || 'ask');
  const [maxIterations, setMaxIterations] = useState<number>(settings.maxAgentIterations || 30);
  const [temperature, setTemperature] = useState<number>(settings.temperature ?? 0.3);
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme || 'light');

  // Provider Health state
  const [healthMap, setHealthMap] = useState<Record<AIProviderType, ProviderHealthStatus>>({
    gemini: 'HEALTHY',
    openrouter: 'HEALTHY',
    custom: 'HEALTHY',
  });

  // UI helpers
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    target: string;
    success?: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  const [showKeyGemini, setShowKeyGemini] = useState(false);
  const [showKeyOpenRouter, setShowKeyOpenRouter] = useState(false);
  const [showKeyCustom, setShowKeyCustom] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [usageSummary, setUsageSummary] = useState<AIUsageSummary | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<AITelemetryLog[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Load provider health and usage data
  useEffect(() => {
    providerManager.getAllHealthStatuses().then(setHealthMap);

    if (activeTab === 'usage') {
      loadUsageData();
    }
  }, [activeTab]);

  const loadUsageData = async () => {
    setIsLoadingUsage(true);
    try {
      const summary = await desktopBridge.getAIUsage();
      setUsageSummary(summary);
    } catch {
      // ignore
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const handleTestConnection = async (targetProvider: AIProviderType) => {
    setIsTesting(targetProvider);
    setTestResult(null);
    try {
      let options: any = {};
      if (targetProvider === 'openrouter') {
        options = {
          apiKey: openRouterApiKey.trim() || undefined,
          model: openRouterModel,
          baseUrl: openRouterBaseUrl,
        };
      } else if (targetProvider === 'custom') {
        options = {
          apiKey: customProviderApiKey.trim() || undefined,
          model: customProviderModel,
          baseUrl: customProviderBaseUrl,
        };
      } else {
        options = {
          apiKey: geminiApiKey.trim() || undefined,
          model: modelName,
        };
      }

      const result = await desktopBridge.testAIConnection(targetProvider, options);
      setTestResult({
        target: targetProvider,
        ...result,
      });

      // Update health cache
      if (result.success) {
        setHealthMap((prev) => ({ ...prev, [targetProvider]: 'HEALTHY' }));
      } else {
        setHealthMap((prev) => ({ ...prev, [targetProvider]: 'ERROR' }));
      }
    } catch (err: any) {
      setTestResult({
        target: targetProvider,
        success: false,
        error: err.message || 'Gagal terhubung ke provider AI.',
      });
      setHealthMap((prev) => ({ ...prev, [targetProvider]: 'ERROR' }));
    } finally {
      setIsTesting(null);
    }
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const list = [...providerPriority];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setProviderPriority(list);
  };

  const handleExportConfig = () => {
    const exportData = {
      aiProvider: provider,
      modelName,
      openRouterModel,
      openRouterBaseUrl,
      enableCustomProvider,
      customProviderName,
      customProviderBaseUrl,
      customProviderModel,
      providerPriority,
      fallbackProvider,
      autoFallback,
      askBeforeFallback,
      aiSafetyMode,
      reviewMode,
      maxAgentIterations: maxIterations,
      temperature,
      theme,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salamacode-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.aiProvider) setProvider(imported.aiProvider);
        if (imported.modelName) setModelName(imported.modelName);
        if (imported.openRouterModel) setOpenRouterModel(imported.openRouterModel);
        if (imported.openRouterBaseUrl) setOpenRouterBaseUrl(imported.openRouterBaseUrl);
        if (imported.enableCustomProvider !== undefined)
          setEnableCustomProvider(imported.enableCustomProvider);
        if (imported.customProviderName) setCustomProviderName(imported.customProviderName);
        if (imported.customProviderBaseUrl) setCustomProviderBaseUrl(imported.customProviderBaseUrl);
        if (imported.customProviderModel) setCustomProviderModel(imported.customProviderModel);
        if (imported.providerPriority) setProviderPriority(imported.providerPriority);
        if (imported.fallbackProvider) setFallbackProvider(imported.fallbackProvider);
        if (imported.autoFallback !== undefined) setAutoFallback(imported.autoFallback);
        if (imported.askBeforeFallback !== undefined)
          setAskBeforeFallback(imported.askBeforeFallback);
        if (imported.aiSafetyMode) setAiSafetyMode(imported.aiSafetyMode);
        if (imported.reviewMode) setReviewMode(imported.reviewMode);
        if (imported.maxAgentIterations) setMaxIterations(imported.maxAgentIterations);
        if (imported.temperature !== undefined) setTemperature(imported.temperature);
        if (imported.theme) setTheme(imported.theme);
        alert('Konfigurasi berhasil dimuat!');
      } catch (err: any) {
        alert(`Gagal memuat konfigurasi: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetSettings = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan seluruh konfigurasi AI ke default?')) {
      setProvider('gemini');
      setModelName('gemini-3.8-flash');
      setOpenRouterModel('google/gemini-2.5-flash');
      setOpenRouterBaseUrl('https://openrouter.ai/api/v1');
      setEnableCustomProvider(false);
      setCustomProviderName('Local Ollama / LM Studio');
      setCustomProviderBaseUrl('http://localhost:11434/v1');
      setCustomProviderModel('llama3:8b');
      setProviderPriority(['gemini', 'openrouter', 'custom']);
      setFallbackProvider('openrouter');
      setAutoFallback(true);
      setAskBeforeFallback(true);
      setAiSafetyMode('Balanced');
      setReviewMode('ask');
      setMaxIterations(30);
      setTemperature(0.3);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsUpdatingProfile(true);
    setProfileSuccessMsg(null);
    try {
      const res = await ProfileService.updateProfile({
        fullName: editFullName.trim(),
        displayName: editDisplayName.trim(),
      });
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setProfileSuccessMsg('Profil berhasil diperbarui!');
        setTimeout(() => setProfileSuccessMsg(null), 3000);
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'HAPUS AKUN SAYA') {
      alert('Ketik "HAPUS AKUN SAYA" untuk mengonfirmasi penghapusan.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      const res = await ProfileService.deleteAccount();
      if (res.success) {
        alert('Akun Anda berhasil dihapus.');
        window.location.reload();
      } else {
        alert(res.message);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushingQueue(true);
    try {
      await SyncService.flushQueue();
      setOfflineQueueLength(SyncService.getQueueLength());
    } finally {
      setIsFlushingQueue(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await SyncService.updateCloudSyncPreferences({
        syncProjectMetadata,
        syncConversationMetadata,
        sendAnonymousDiagnostics,
      });

      await onSave({
        aiProvider: provider,
        geminiApiKey: geminiApiKey.trim() || undefined,
        modelName,
        openRouterApiKey: openRouterApiKey.trim() || undefined,
        openRouterBaseUrl: openRouterBaseUrl.trim() || 'https://openrouter.ai/api/v1',
        openRouterModel,
        enableCustomProvider,
        customProviderName,
        customProviderBaseUrl,
        customProviderApiKey: customProviderApiKey.trim() || undefined,
        customProviderModel,
        providerPriority,
        fallbackProvider,
        autoFallback,
        askBeforeFallback,
        aiSafetyMode,
        reviewMode,
        maxAgentIterations: Number(maxIterations) || 30,
        temperature: Number(temperature),
        theme,
        syncProjectMetadata,
        syncConversationMetadata,
        sendAnonymousDiagnostics,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const renderHealthIndicator = (status: ProviderHealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        );
      case 'LIMITED':
        return (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full font-semibold border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Rate Limited
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center gap-1 text-[10px] text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full font-semibold border border-rose-200 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Error
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
            Not configured
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                Pengaturan AI SalamaCode
              </h2>
              <span className="text-[10px] text-slate-400">
                Multi-Provider Orchestration &amp; Smart Router
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex items-center gap-1.5 text-xs font-semibold shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'account'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Akun &amp; Profil</span>
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'providers'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Providers</span>
          </button>

          <button
            onClick={() => setActiveTab('routing')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'routing'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Smart Router</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cloud'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud &amp; Privasi</span>
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'usage'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Usage</span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs custom-scrollbar flex-1">
          {/* TAB 1: AI PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-5">
              {/* Active Provider Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block text-xs">
                  Pilih Provider Utama Aktif:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('gemini')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      provider === 'gemini'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold">Google Gemini</span>
                      {renderHealthIndicator(healthMap.gemini)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Direkomendasikan • Cepat &amp; Cerdas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('openrouter')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      provider === 'openrouter'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold">OpenRouter</span>
                      {renderHealthIndicator(healthMap.openrouter)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Multi-Model (Claude, Llama, DeepSeek)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('custom')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      provider === 'custom'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold">Custom OpenAI</span>
                      {renderHealthIndicator(healthMap.custom)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Ollama / vLLM / LM Studio / Local
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD 1: GOOGLE GEMINI */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Konfigurasi Google Gemini
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestConnection('gemini')}
                    disabled={isTesting === 'gemini'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-medium transition cursor-pointer"
                  >
                    {isTesting === 'gemini' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 text-amber-500" />
                    )}
                    <span>Test Connection</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                      <Key className="w-3 h-3 text-blue-600" />
                      <span>Gemini API Key</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKeyGemini(!showKeyGemini)}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {showKeyGemini ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKeyGemini ? 'Sembunyikan' : 'Tampilkan'}</span>
                    </button>
                  </div>
                  <input
                    type={showKeyGemini ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Kosongkan jika menggunakan GEMINI_API_KEY dari env"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                    Model Gemini
                  </label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Rekomendasi • Cepat &amp; Akurat)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Analisis Mendalam)</option>
                  </select>
                </div>
              </div>

              {/* CARD 2: OPENROUTER */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Konfigurasi OpenRouter
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestConnection('openrouter')}
                    disabled={isTesting === 'openrouter'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-medium transition cursor-pointer"
                  >
                    {isTesting === 'openrouter' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 text-amber-500" />
                    )}
                    <span>Test Connection</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                      <Key className="w-3 h-3 text-purple-600" />
                      <span>OpenRouter API Key</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKeyOpenRouter(!showKeyOpenRouter)}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {showKeyOpenRouter ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKeyOpenRouter ? 'Sembunyikan' : 'Tampilkan'}</span>
                    </button>
                  </div>
                  <input
                    type={showKeyOpenRouter ? 'text' : 'password'}
                    value={openRouterApiKey}
                    onChange={(e) => setOpenRouterApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      OpenRouter Base URL
                    </label>
                    <input
                      type="text"
                      value={openRouterBaseUrl}
                      onChange={(e) => setOpenRouterBaseUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      Model OpenRouter
                    </label>
                    <input
                      type="text"
                      value={openRouterModel}
                      onChange={(e) => setOpenRouterModel(e.target.value)}
                      placeholder="google/gemini-2.5-flash"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: CUSTOM OPENAI-COMPATIBLE (Ollama / Local / vLLM) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableCustomProvider}
                      onChange={(e) => setEnableCustomProvider(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Aktifkan Custom OpenAI-Compatible Provider (Local / Ollama)
                    </span>
                  </label>

                  {enableCustomProvider && (
                    <button
                      type="button"
                      onClick={() => handleTestConnection('custom')}
                      disabled={isTesting === 'custom'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-medium transition cursor-pointer"
                    >
                      {isTesting === 'custom' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3 text-amber-500" />
                      )}
                      <span>Test Endpoint</span>
                    </button>
                  )}
                </div>

                {enableCustomProvider && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                          Nama Display Provider
                        </label>
                        <input
                          type="text"
                          value={customProviderName}
                          onChange={(e) => setCustomProviderName(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                          Model Name
                        </label>
                        <input
                          type="text"
                          value={customProviderModel}
                          onChange={(e) => setCustomProviderModel(e.target.value)}
                          placeholder="llama3:8b atau qwen2.5-coder"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                        Base URL (OpenAI-compatible)
                      </label>
                      <input
                        type="text"
                        value={customProviderBaseUrl}
                        onChange={(e) => setCustomProviderBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                          API Key (opsional untuk server lokal)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowKeyCustom(!showKeyCustom)}
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {showKeyCustom ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showKeyCustom ? 'Sembunyikan' : 'Tampilkan'}</span>
                        </button>
                      </div>
                      <input
                        type={showKeyCustom ? 'text' : 'password'}
                        value={customProviderApiKey}
                        onChange={(e) => setCustomProviderApiKey(e.target.value)}
                        placeholder="none / opsional"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Test Result Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>{testResult.message || (testResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal')}</span>
                      {testResult.latencyMs && (
                        <span className="font-mono text-[10px] bg-white/70 dark:bg-black/30 px-1.5 py-0.5 rounded">
                          {testResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                    {testResult.error && (
                      <p className="text-[11px] opacity-90 mt-0.5 font-mono">{testResult.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ROUTING & SMART ROUTER */}
          {activeTab === 'routing' && (
            <div className="space-y-5">
              {/* Priority Reordering List */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-blue-600" />
                    <span>Prioritas Urutan Fallback Provider</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Jika provider atas mengalami rate limit atau down, Smart Router akan otomatis mencoba provider berikutnya sesuai urutan ini.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {providerPriority.map((p, idx) => (
                    <div
                      key={p}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                          {p === 'gemini'
                            ? 'Google Gemini'
                            : p === 'openrouter'
                            ? 'OpenRouter'
                            : customProviderName}
                        </span>
                        {renderHealthIndicator(healthMap[p])}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movePriority(idx, 'up')}
                          disabled={idx === 0}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded disabled:opacity-30 text-[10px] font-bold"
                        >
                          ▲ Up
                        </button>
                        <button
                          type="button"
                          onClick={() => movePriority(idx, 'down')}
                          disabled={idx === providerPriority.length - 1}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded disabled:opacity-30 text-[10px] font-bold"
                        >
                          ▼ Down
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto Fallback & Prompt Settings */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoFallback}
                      onChange={(e) => setAutoFallback(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 rounded"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        Aktifkan Auto Fallback
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Otomatis mengalihkan permintaan ke provider berikutnya jika terjadi error 429 Quota Exceeded atau Network Timeout.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={askBeforeFallback}
                      onChange={(e) => setAskBeforeFallback(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 rounded"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        Tanyakan konfirmasi pengguna sebelum melakukan fallback
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Menampilkan dialog modal persetujuan sebelum berpindah ke provider lain saat agent sedang berjalan.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                      AI Safety &amp; Routing Mode
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Mengatur agresivitas Smart Router dalam mengevaluasi keamanan instruksi dan pergantian provider.
                    </span>
                  </div>

                  <select
                    value={aiSafetyMode}
                    onChange={(e) => setAiSafetyMode(e.target.value as any)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="Safe">Safe (Ketat)</option>
                    <option value="Balanced">Balanced (Seimbang)</option>
                    <option value="Auto">Auto (Adaptif)</option>
                  </select>
                </div>
              </div>

              {/* Export / Import / Reset Config */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                    Backup &amp; Reset Konfigurasi
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Ekspor atau impor konfigurasi (tanpa plaintext API Key)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportConfig}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-medium transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor</span>
                  </button>

                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-medium transition cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Impor</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportConfig}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 text-xs font-medium transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USAGE & TELEMETRY */}
          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Statistik Penggunaan &amp; Telemetri AI
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Laporan volume permintaan harian, tingkat keberhasilan, dan penggunaan token.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadUsageData}
                  disabled={isLoadingUsage}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs"
                >
                  {isLoadingUsage ? 'Memuat...' : 'Refresh Data'}
                </button>
              </div>

              {/* Usage Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Total Requests</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {usageSummary?.totalRequests || 0}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                    Sukses
                  </span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                    {usageSummary?.successfulRequests || 0}
                  </span>
                </div>

                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block">
                    Gagal / Error
                  </span>
                  <span className="text-base font-bold text-rose-700 dark:text-rose-300">
                    {usageSummary?.failedRequests || 0}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 block">
                    Total Tokens
                  </span>
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                    {(usageSummary?.totalTokens || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Breakdown by Provider */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                  Distribusi Penggunaan per Provider:
                </span>
                <div className="space-y-2">
                  {['gemini', 'openrouter', 'custom'].map((p) => {
                    const count = (usageSummary?.byProvider as any)?.[p] || 0;
                    const total = usageSummary?.totalRequests || 1;
                    const percent = Math.round((count / total) * 100);
                    return (
                      <div key={p} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                            {p === 'gemini'
                              ? 'Google Gemini'
                              : p === 'openrouter'
                              ? 'OpenRouter'
                              : 'Custom OpenAI'}
                          </span>
                          <span className="font-mono text-slate-500">
                            {count} req ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p === 'gemini'
                                ? 'bg-blue-600'
                                : p === 'openrouter'
                                ? 'bg-purple-600'
                                : 'bg-amber-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL & KEAMANAN */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Review Mode Selection */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-200 block text-xs">
                  Mode Persetujuan Eksekusi (Review Mode)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      reviewMode === 'ask'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reviewMode"
                      value="ask"
                      checked={reviewMode === 'ask'}
                      onChange={() => setReviewMode('ask')}
                      className="mr-2"
                    />
                    <span>Konfirmasi Manual (Review Setiap Langkah)</span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Agent meminta izin sebelum menjalankan terminal atau mengubah file sensitif.
                    </p>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      reviewMode === 'auto'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reviewMode"
                      value="auto"
                      checked={reviewMode === 'auto'}
                      onChange={() => setReviewMode('auto')}
                      className="mr-2"
                    />
                    <span>Otomatis (Auto Approve Safe Tools)</span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      AI menulis kode dan menjalankan verifikasi secara otonom (kecuali perintah berbahaya).
                    </p>
                  </label>
                </div>
              </div>

              {/* Turn limits & Temperature */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    Batas Langkah Agent (Max Iterations)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value) || 30)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    Temperature: {temperature}
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full mt-2 accent-blue-600"
                  />
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                  Tema Tampilan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-950/40 text-blue-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-400'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACCOUNT & PROFILE */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg">
                    {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {currentUser?.fullName || 'Local Developer'}
                    </h3>
                    <div className="text-[11px] text-slate-500">{currentUser?.email || 'offline@local.app'}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase">
                        Plan: {currentUser?.planId || 'free'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold text-[10px]">
                        Role: {currentUser?.role || 'user'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">Edit Profil</h4>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Display Name / Alias
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Contoh: Noor"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  {isUpdatingProfile ? 'Menyimpan...' : 'Perbarui Profil'}
                </button>
              </form>

              {/* Danger Zone: Delete Account */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-rose-600 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Danger Zone: Hapus Akun</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Menghapus akun cloud Anda dan seluruh metadata terkait. Berkas lokal di komputer Anda tidak akan tersentuh.
                </p>

                {!showDeleteModal ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="mt-3 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Hapus Akun Saya...
                  </button>
                ) : (
                  <div className="mt-3 p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
                    <p className="text-xs text-rose-800 font-semibold">
                      Ketik <strong>HAPUS AKUN SAYA</strong> untuk konfirmasi penghapusan permanen:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="HAPUS AKUN SAYA"
                      className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-xl outline-hidden focus:border-rose-600 font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteConfirmText('');
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount || deleteConfirmText !== 'HAPUS AKUN SAYA'}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        {isDeletingAccount ? 'Menghapus...' : 'Konfirmasi Hapus Akun'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: CLOUD & PRIVACY */}
          {activeTab === 'cloud' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Preferensi Sinkronisasi Cloud &amp; Privasi
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tentukan data apa saja yang diizinkan untuk disinkronkan ke Supabase Cloud.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncProjectMetadata}
                    onChange={(e) => setSyncProjectMetadata(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Sinkronisasi Metadata Project
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menyimpan nama project, git branch, dan deteksi framework untuk akses multi-device. Source code tetap lokal.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConversationMetadata}
                    onChange={(e) => setSyncConversationMetadata(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Sinkronisasi Percakapan Agent
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menyimpan ringkasan prompt agent di cloud (isi file dan rahasia otomatis disanitasi).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendAnonymousDiagnostics}
                    onChange={(e) => setSendAnonymousDiagnostics(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Kirim Diagnostik Anonim
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Membantu pengembangan SalamaCode dengan melaporkan tingkat keberhasilan eksekusi agent tanpa data pribadi.
                    </span>
                  </div>
                </label>
              </div>

              {/* Offline Queue Management */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    Antrean Sinkronisasi Offline (Queue)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {offlineQueueLength} item tertunda menunggu koneksi cloud
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleFlushQueue}
                  disabled={isFlushingQueue || offlineQueueLength === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                  <span>Flush Antrean</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-16 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <div className="text-[11px] text-slate-400">
            SalamaCode v0.4.0 • Created &amp; Powered by PT Salama Lantabura Int.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
