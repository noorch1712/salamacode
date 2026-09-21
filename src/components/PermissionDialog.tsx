import React, { useState } from 'react';
import {
  ShieldAlert,
  FilePlus,
  FileEdit,
  Terminal,
  Check,
  X,
  Lock,
  Files,
  AlertTriangle,
} from 'lucide-react';
import { PendingPermission } from '../types/index.js';
import { DiffViewer } from './DiffViewer.js';

interface PermissionDialogProps {
  permission: PendingPermission | null;
  onAllow: () => void;
  onReject: () => void;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  permission,
  onAllow,
  onReject,
}) => {
  if (!permission) return null;

  const [activeMultiIndex, setActiveMultiIndex] = useState(0);

  const isCommand = permission.type === 'command_run' || permission.toolName === 'run_command';
  const isMultiFile = permission.type === 'multi_file' && permission.multiChanges && permission.multiChanges.length > 0;
  const isWrite = permission.toolName === 'write_file';
  const isEdit = permission.toolName === 'edit_file';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 shadow-2xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {isCommand
                  ? 'Konfirmasi Eksekusi Command Terminal'
                  : isMultiFile
                  ? 'Konfirmasi Perubahan Multi-File'
                  : 'Persetujuan Akses File Diperlukan'}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300/80 font-medium">
                {isCommand
                  ? 'AI Coding Agent meminta izin untuk mengeksekusi terminal command.'
                  : 'AI Coding Agent meminta izin untuk membuat atau mengubah file project.'}
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md ${
              permission.securityLevel === 'APPROVAL_REQUIRED'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200'
                : 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
            }`}
          >
            {permission.securityLevel === 'APPROVAL_REQUIRED' ? 'Perlu Konfirmasi' : 'Keamanan Lokal'}
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              {isCommand ? (
                <Terminal className="w-4 h-4 text-amber-600" />
              ) : isMultiFile ? (
                <Files className="w-4 h-4 text-purple-600" />
              ) : isWrite ? (
                <FilePlus className="w-4 h-4 text-blue-600" />
              ) : (
                <FileEdit className="w-4 h-4 text-purple-600" />
              )}
              <span>{permission.description}</span>
            </div>

            {/* Target Path or Command display */}
            {isCommand ? (
              <div className="font-mono text-xs font-bold text-cyan-400 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg mt-2 select-all flex items-center gap-2">
                <span className="text-slate-500 select-none">$</span>
                <span>{permission.command}</span>
              </div>
            ) : !isMultiFile ? (
              <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg mt-2 truncate select-all">
                {permission.relativePath}
              </div>
            ) : null}
          </div>

          {/* Multi-file selector tabs */}
          {isMultiFile && permission.multiChanges && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
                {permission.multiChanges.map((change, idx) => (
                  <button
                    key={change.filePath}
                    onClick={() => setActiveMultiIndex(idx)}
                    className={`px-3 py-1 rounded-md text-xs font-medium font-mono whitespace-nowrap transition ${
                      activeMultiIndex === idx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <span className="mr-1.5 text-[10px] uppercase font-bold text-slate-400">
                      {change.type === 'create' ? '+' : 'M'}
                    </span>
                    {change.relativePath}
                  </button>
                ))}
              </div>

              {/* Diff for active multi file */}
              {permission.multiChanges[activeMultiIndex] && (
                <DiffViewer
                  originalContent={permission.multiChanges[activeMultiIndex].originalContent}
                  newContent={permission.multiChanges[activeMultiIndex].newContent}
                  filePath={permission.multiChanges[activeMultiIndex].relativePath}
                />
              )}
            </div>
          )}

          {/* Single File Diff Viewer */}
          {!isCommand && !isMultiFile && permission.content !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-semibold mb-1.5">
                <span>Pratinjau Perubahan (Diff Viewer):</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {permission.content.split('\n').length} baris
                </span>
              </div>
              <DiffViewer
                originalContent={permission.originalContent}
                newContent={permission.content}
                filePath={permission.relativePath}
              />
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg p-3 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p>
              SalamaCode mengisolasi operasi di workspace dan secara otomatis membuat snapshot backup sebelum modifikasi dilakukan. Perubahan tidak akan diterapkan sampai Anda menyetujuinya.
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-end gap-3 shrink-0">
          <button
            id="btn-permission-reject"
            onClick={onReject}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>Tolak (Reject)</span>
          </button>

          <button
            id="btn-permission-allow"
            onClick={onAllow}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Setujui & Jalankan (Approve)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
