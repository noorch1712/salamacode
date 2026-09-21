import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Lightbulb,
  FileText,
  Square,
  Terminal,
  Search,
  GitBranch,
  ListTodo,
  Info,
  ChevronDown,
  Star,
  Cpu,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AgentState,
  AIModel,
  AIProviderType,
  AppSettings,
  ChatMessage,
  FallbackDecision,
  ProviderHealthStatus,
  TaskMode,
  TaskPlanItem,
  TaskType,
} from '../types/index.js';
import { providerManager } from '../services/ai/ProviderManager.js';

interface AIChatProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  agentState: AgentState;
  onStopAgent?: () => void;
  onClearChat: () => void;
  onOpenFileByPath?: (path: string) => void;
  currentPlan?: TaskPlanItem[];
  settings: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
  fallbackNotice?: FallbackDecision | null;
  providerHealth?: Record<string, ProviderHealthStatus>;
}

const QUICK_PROMPTS = [
  'Buatkan project Node.js sederhana dengan math.js, buat unit test, dan jalankan verifikasi.',
  'Cari semua file yang menggunakan fungsi tertentu di project ini menggunakan search_files.',
  'Periksa git status dan jelaskan file apa saja yang telah dimodifikasi.',
  'Buatkan halaman login responsive React di src/pages/Login.tsx dengan styling Tailwind.',
];

export const AIChat: React.FC<AIChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  agentState,
  onStopAgent,
  onClearChat,
  onOpenFileByPath,
  currentPlan,
  settings,
  onUpdateSettings,
  fallbackNotice,
  providerHealth,
}) => {
  const [input, setInput] = useState('');
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load models whenever active provider changes
  useEffect(() => {
    let isMounted = true;
    providerManager.listModels(settings.aiProvider).then((models) => {
      if (isMounted) {
        setAvailableModels(models);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [settings.aiProvider]);

  const activeModelId =
    settings.aiProvider === 'gemini'
      ? settings.modelName || 'gemini-3.8-flash'
      : settings.aiProvider === 'openrouter'
      ? settings.openRouterModel || 'google/gemini-2.5-flash'
      : settings.customProviderModel || 'custom-model';

  const activeModel = availableModels.find((m) => m.id === activeModelId) || {
    id: activeModelId,
    name: activeModelId,
    provider: settings.aiProvider,
    contextWindow: 1048576,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    costType: 'Free',
    estimatedCost: '$0.0000',
    status: 'Available',
    description: 'Model aktif saat ini.',
  };

  const isFavorite = (settings.favoriteModels || []).includes(activeModelId);

  const toggleFavorite = () => {
    const list = settings.favoriteModels || [];
    const updated = isFavorite
      ? list.filter((id) => id !== activeModelId)
      : [...list, activeModelId];
    onUpdateSettings?.({ favoriteModels: updated });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, agentState]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const getStateBadge = () => {
    switch (agentState) {
      case 'ANALYZING':
        return { label: 'Menganalisis...', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-900' };
      case 'PLANNING':
        return { label: 'Merencanakan...', color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-900' };
      case 'EXECUTING':
        return { label: 'Mengeksekusi Tool...', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-900' };
      case 'WAITING_PERMISSION':
        return { label: 'Menunggu Izin...', color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:border-purple-900' };
      case 'VERIFYING':
        return { label: 'Memverifikasi...', color: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/60 dark:border-cyan-900' };
      case 'ANALYZING_ERROR':
        return { label: 'Menganalisis Error...', color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-900' };
      case 'STOPPED':
        return { label: 'Dihentikan', color: 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700' };
      default:
        return null;
    }
  };

  const stateBadge = getStateBadge();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative">
      {/* Top AI Status and Selector Toolbar */}
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Live AI Status Badge (Requirement 35) */}
          {fallbackNotice ? (
            <div
              className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg text-[11px] font-medium"
              title={`Fallback reason: ${fallbackNotice.reason}`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="capitalize">{fallbackNotice.previousProvider} unavailable</span>
              <span className="text-slate-400">→</span>
              <span className="font-semibold capitalize">{fallbackNotice.nextProvider}</span>
            </div>
          ) : providerHealth?.[settings.aiProvider] === 'ERROR' ? (
            <div
              className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-lg text-[11px] font-medium"
              title="Provider mengalami error atau tidak terhubung"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>No AI provider available</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-lg text-[11px] font-medium"
              title="AI Provider Siap"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="capitalize">
                {settings.aiProvider === 'gemini'
                  ? 'Gemini'
                  : settings.aiProvider === 'openrouter'
                  ? 'OpenRouter'
                  : 'Custom'}
              </span>
            </div>
          )}

          {/* Provider Selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <select
              id="select-ai-provider"
              value={settings.aiProvider}
              onChange={(e) => {
                const p = e.target.value as AIProviderType;
                onUpdateSettings?.({ aiProvider: p });
              }}
              disabled={isLoading}
              className="bg-transparent border-none text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              {settings.enableCustomProvider && (
                <option value="custom">{settings.customProviderName || 'Custom OpenAI'}</option>
              )}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg max-w-[200px]">
            <select
              id="select-ai-model"
              value={activeModelId}
              onChange={(e) => {
                const val = e.target.value;
                if (settings.aiProvider === 'gemini') {
                  onUpdateSettings?.({ modelName: val });
                } else if (settings.aiProvider === 'openrouter') {
                  onUpdateSettings?.({ openRouterModel: val });
                } else {
                  onUpdateSettings?.({ customProviderModel: val });
                }
              }}
              disabled={isLoading}
              className="bg-transparent border-none text-[11px] text-slate-700 dark:text-slate-200 outline-none truncate w-full cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Favorite Star Button */}
          <button
            onClick={toggleFavorite}
            className={`p-1 rounded-lg border transition ${
              isFavorite
                ? 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900'
                : 'text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}
            title={isFavorite ? 'Hapus dari favorit' : 'Tandai sebagai favorit'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Model Info Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowModelInfo(!showModelInfo)}
              className="p-1 rounded-lg border text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition"
              title="Informasi detail model"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {showModelInfo && (
              <div className="absolute left-0 top-full mt-1.5 w-64 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 text-[11px] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-1.5 border-b pb-1.5 border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{activeModel.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {activeModel.costType || 'Free'}
                  </span>
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <p className="text-[10px] text-slate-400">{activeModel.description}</p>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-400">Context Window:</span>
                    <span className="font-mono font-medium">{(activeModel.contextWindow || 1048576).toLocaleString()} tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tool Calling:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Supported</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Streaming:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Supported</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vision:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{activeModel.supportsVision ? 'Supported' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Biaya:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{activeModel.estimatedCost || '$0.00'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task Mode Selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg">
            <span className="text-[10px] text-slate-400 font-medium">Mode:</span>
            <select
              value={settings.taskMode || 'Coding'}
              onChange={(e) => onUpdateSettings?.({ taskMode: e.target.value as TaskType })}
              disabled={isLoading}
              className="bg-transparent border-none text-[11px] text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="Coding">Coding</option>
              <option value="Debugging">Debugging</option>
              <option value="Refactoring">Refactoring</option>
              <option value="Planning">Planning</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>

        {/* State Badge & Actions */}
        <div className="flex items-center gap-2">
          {stateBadge && (
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stateBadge.color}`}
            >
              {isLoading && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {stateBadge.label}
            </span>
          )}

          {isLoading && onStopAgent && (
            <button
              onClick={onStopAgent}
              className="inline-flex items-center gap-1 text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 px-2 py-0.5 rounded font-medium transition"
              title="Hentikan eksekusi agent"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              id="btn-clear-chat"
              onClick={onClearChat}
              disabled={isLoading}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-600 px-2 py-1 rounded transition-colors"
              title="Bersihkan riwayat percakapan"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Plan step indicator if agent has an active plan */}
      {currentPlan && currentPlan.length > 0 && isLoading && (
        <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 text-xs">
          <div className="flex items-center gap-1 text-blue-800 dark:text-blue-300 font-semibold mb-1">
            <ListTodo className="w-3.5 h-3.5" />
            <span>Task Execution Plan:</span>
          </div>
          <div className="space-y-1 pl-4">
            {currentPlan.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-[11px]">
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                )}
                {step.status === 'pending' && (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                )}
                {step.status === 'failed' && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
                <span
                  className={
                    step.status === 'completed'
                      ? 'text-slate-500 line-through'
                      : step.status === 'running'
                      ? 'text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shadow-xs border border-blue-100 dark:border-blue-900/60">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                SalamaCode AI Coding Agent
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Agent otonom untuk inspeksi kode, pembuatan file, perbaikan bug, dan eksekusi
                terminal terverifikasi.
              </p>
            </div>

            <div className="w-full text-left space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Contoh Instruksi Cepat:</span>
              </div>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left text-xs p-2 rounded-xl bg-slate-50 hover:bg-blue-50/60 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition hover:border-blue-300"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                }`}
              >
                {/* Text Content */}
                <div className="whitespace-pre-wrap select-text">{msg.content}</div>

                {/* Tool calls summary if present */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      <span>Alat yang Dipanggil ({msg.toolCalls.length}):</span>
                    </div>

                    {msg.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1"
                      >
                        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 font-semibold">
                          <span className="flex items-center gap-1">
                            {tc.name === 'run_command' && <Terminal className="w-3 h-3" />}
                            {tc.name === 'write_file' && <FileText className="w-3 h-3" />}
                            {tc.name === 'search_files' && <Search className="w-3 h-3" />}
                            {tc.name === 'git_status' && <GitBranch className="w-3 h-3" />}
                            {tc.name}
                          </span>
                          <span className="text-[10px] text-slate-400">args</span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {JSON.stringify(tc.args)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tool results summary */}
                {msg.toolResults && msg.toolResults.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    {msg.toolResults.map((tr, idx) => (
                      <div
                        key={idx}
                        className={`text-[10px] flex items-center gap-1.5 ${
                          tr.success ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tr.success ? (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 shrink-0" />
                        )}
                        <span className="font-mono">{tr.name}:</span>
                        <span className="truncate">
                          {tr.success ? 'Eksekusi sukses' : tr.error}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] mt-2 flex items-center justify-end ${
                    msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all shadow-2xs">
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            rows={1}
            value={input}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Tulis instruksi untuk AI (misal: buat file, analisa kode, jalankan test)..."
            className="flex-1 bg-transparent resize-none border-none outline-hidden text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 max-h-36 py-1 px-2 leading-relaxed"
          />

          <button
            id="btn-send-message"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer"
            title="Kirim instruksi (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-2 select-none">
          <span>Tekan <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px]">Enter</kbd> untuk kirim, <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px]">Shift+Enter</kbd> untuk baris baru</span>
          <span>Ctrl + P: Command Palette</span>
        </div>
      </div>
    </div>
  );
};
