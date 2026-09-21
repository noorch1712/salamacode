import React, { useState } from 'react';
import {
  FolderOpen,
  Sparkles,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Clock,
  FolderCode,
} from 'lucide-react';
import { WorkspaceInfo } from '../types/index.js';

interface WelcomeProps {
  onSelectWorkspace: (path: string) => void;
  recentWorkspaces: WorkspaceInfo[];
  onOpenNativeFolderPicker: () => void;
  isElectron: boolean;
}

export const Welcome: React.FC<WelcomeProps> = ({
  onSelectWorkspace,
  recentWorkspaces,
  onOpenNativeFolderPicker,
  isElectron,
}) => {
  const [customPath, setCustomPath] = useState('');
  const [isOpening, setIsOpening] = useState(false);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPath.trim()) return;
    onSelectWorkspace(customPath.trim());
  };

  const handlePickFolder = async () => {
    setIsOpening(true);
    try {
      await onOpenNativeFolderPicker();
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between select-none">
      {/* Top Brand Bar */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">
              SalamaCode
            </span>
            <span className="ml-2 text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
              Desktop Prototype
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Fase 1 • Local Workspace
        </div>
      </div>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl max-w-xl w-full p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-5 shadow-xs">
            <FolderCode className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome to SalamaCode
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            AI Coding Agent lokal untuk Windows. Pilih folder project untuk dijadikan workspace kerja Anda.
          </p>

          {/* Primary Action Button */}
          <div className="mt-8">
            <button
              id="btn-welcome-choose-folder"
              onClick={handlePickFolder}
              disabled={isOpening}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-98 cursor-pointer"
            >
              <FolderOpen className="w-5 h-5" />
              <span>{isOpening ? 'Membuka dialog...' : '📁 PILIH FOLDER PROJECT'}</span>
            </button>
            <p className="text-[11px] text-slate-400 mt-2">
              {isElectron
                ? 'Menggunakan native Windows dialog.showOpenDialog()'
                : 'Pilih workspace project atau gunakan preset TestApp di bawah'}
            </p>
          </div>

          {/* Or enter custom path */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <form onSubmit={handleCustomSubmit} className="flex gap-2 max-w-md mx-auto">
              <input
                id="input-custom-workspace-path"
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="Atau ketik path folder (contoh: workspaces/TestApp)"
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={!customPath.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Buka
              </button>
            </form>
          </div>

          {/* Presets & Recent Workspaces */}
          {recentWorkspaces.length > 0 && (
            <div className="mt-8 text-left border-t border-slate-100 pt-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Pilih Cepat / Project Terakhir:</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {recentWorkspaces.map((ws, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectWorkspace(ws.path)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                          {ws.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {ws.path}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security Features Info */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong className="text-slate-800 block">Workspace Security</strong>
                <span className="text-slate-500">Path traversal diblokir. Akses terbatas di root workspace.</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
              <Cpu className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong className="text-slate-800 block">Permission System</strong>
                <span className="text-slate-500">AI wajib meminta izin sebelum membuat atau mengubah file.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Required Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white/70">
        Created &amp; Powered by <strong className="text-slate-700">PT Salama Lantabura Int.</strong>
      </footer>
    </div>
  );
};
