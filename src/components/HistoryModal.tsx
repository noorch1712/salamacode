import React from 'react';
import { X, History, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import { ProjectHistoryItem } from '../types/index.js';

interface HistoryModalProps {
  history: ProjectHistoryItem[];
  onClose: () => void;
  onSelectHistory?: (item: ProjectHistoryItem) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  history,
  onClose,
  onSelectHistory,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Project History
              </h2>
              <p className="text-[11px] text-slate-400">
                Aktivitas &amp; percakapan tersimpan secara lokal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-2.5 custom-scrollbar">
          {history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium text-slate-600">Belum ada riwayat</p>
              <p className="text-[11px] mt-0.5">
                Setiap percakapan dengan AI akan otomatis dicatat di sini.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectHistory?.(item)}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-800 text-xs group-hover:text-blue-700 truncate">
                    {item.title}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span className="truncate">{item.workspaceName}</span>
                  <span className="flex items-center gap-1 text-slate-500 font-sans shrink-0">
                    <MessageSquare className="w-3 h-3" />
                    {item.messageCount} pesan
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
