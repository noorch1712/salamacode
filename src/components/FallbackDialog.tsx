import React from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { FallbackDecision } from '../types/index.js';

interface FallbackDialogProps {
  decision: FallbackDecision | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FallbackDialog: React.FC<FallbackDialogProps> = ({
  decision,
  onConfirm,
  onCancel,
}) => {
  if (!decision) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/60 max-w-md w-full p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Konfirmasi Pengalihan AI (Smart Fallback)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provider utama mengalami kendala. Smart Router merekomendasikan pengalihan ke provider cadangan.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Penyebab:</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400 text-right truncate max-w-[200px]" title={decision.reason}>
              {decision.reason}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1 font-mono text-xs">
            <div className="px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              {decision.currentProvider}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold">
              {decision.nextProvider} ({decision.model})
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            Batalkan Eksekusi
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Alihkan Sekarang
          </button>
        </div>
      </div>
    </div>
  );
};
