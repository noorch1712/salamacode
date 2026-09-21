import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  RefreshCw,
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { FileBackupItem } from '../types/index.js';
import { desktopBridge } from '../services/api/desktopBridge.js';

interface BackupsPanelProps {
  workspacePath: string;
  onClose: () => void;
  onFilesChanged?: () => void;
}

export const BackupsPanel: React.FC<BackupsPanelProps> = ({
  workspacePath,
  onClose,
  onFilesChanged,
}) => {
  const [backups, setBackups] = useState<FileBackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const list = await desktopBridge.getBackups(workspacePath);
      setBackups(list);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [workspacePath]);

  const handleRollback = async (backup: FileBackupItem) => {
    const confirm = window.confirm(
      `Apakah Anda yakin ingin memulihkan file "${backup.originalPath}" ke versi ${new Date(
        backup.timestamp
      ).toLocaleTimeString()}?`
    );
    if (!confirm) return;

    setRollingBackId(backup.id);
    try {
      const ok = await desktopBridge.rollbackFile(workspacePath, backup.id);
      if (ok) {
        setSuccessMessage(`Berhasil memulihkan "${backup.originalPath}"`);
        onFilesChanged?.();
        loadBackups();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        alert('Gagal memulihkan backup.');
      }
    } catch (err: any) {
      alert(`Error rollback: ${err.message}`);
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs">
      {/* Header */}
      <div className="h-10 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <RotateCcw className="w-4 h-4 text-purple-500" />
          <span>File Backups & Rollback</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
            {backups.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadBackups}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded"
            title="Refresh Backups"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-[11px]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Description */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 leading-relaxed">
        SalamaCode secara otomatis membuat snapshot backup sebelum AI memodifikasi file Anda. Anda dapat melakukan rollback kapan saja.
      </div>

      {/* Backups List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {backups.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <div>Belum ada snapshot backup tersimpan.</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Snapshot akan dibuat saat AI melakukan operasi penulisan atau pengeditan file.
            </div>
          </div>
        ) : (
          backups.map((b) => (
            <div
              key={b.id}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 transition bg-slate-50/50 dark:bg-slate-950/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 truncate max-w-[180px]">
                  {b.originalPath}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(b.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>Alasan: {b.reason}</span>
                <button
                  onClick={() => handleRollback(b)}
                  disabled={rollingBackId === b.id}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-[10px] font-medium flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{rollingBackId === b.id ? 'Memulihkan...' : 'Rollback'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
