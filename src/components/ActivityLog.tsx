import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Activity,
  Trash2,
} from 'lucide-react';
import { ActivityLogItem, ActivityStatus } from '../types/index.js';

interface ActivityLogProps {
  items: ActivityLogItem[];
  onClear?: () => void;
}

function getStatusIcon(status: ActivityStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />;
    case 'waiting_approval':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
    case 'pending':
    default:
      return <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
}

function getStatusBadge(status: ActivityStatus) {
  switch (status) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'running':
      return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
    case 'waiting_approval':
      return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
    case 'error':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'pending':
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ items, onClear }) => {
  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="h-9 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Activity Log
          </span>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
            {items.length}
          </span>
        </div>

        {onClear && items.length > 0 && (
          <button
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
            title="Bersihkan log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
        {items.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Activity className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
            <p>Belum ada aktivitas tercatat.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Jalankan perintah AI untuk melihat jejak eksekusi tool.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-2 rounded-lg border text-xs flex items-start gap-2 transition-all ${getStatusBadge(
                item.status
              )}`}
            >
              <div className="mt-0.5">{getStatusIcon(item.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold truncate">{item.title}</span>
                  <span className="text-[10px] opacity-70 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                {item.detail && (
                  <p className="text-[11px] opacity-80 mt-0.5 font-mono break-all line-clamp-2">
                    {item.detail}
                  </p>
                )}
                {item.toolName && (
                  <span className="inline-block mt-1 text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-black/5 font-medium">
                    tool: {item.toolName}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
