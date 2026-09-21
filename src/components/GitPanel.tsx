import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  FileDiff,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { GitCommitItem, GitStatusResult } from '../types/index.js';
import { desktopBridge } from '../services/api/desktopBridge.js';
import { DiffViewer } from './DiffViewer.js';

interface GitPanelProps {
  workspacePath: string;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
  workspacePath,
  onClose,
  onOpenFile,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'diff' | 'log'>('status');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadGitData = async () => {
    setIsLoading(true);
    try {
      const [gitStatus, gitDiff, gitLog] = await Promise.all([
        desktopBridge.gitStatus(workspacePath),
        desktopBridge.gitDiff(workspacePath),
        desktopBridge.gitLog(workspacePath, 15),
      ]);
      setStatus(gitStatus);
      setDiffText(gitDiff);
      setCommits(gitLog);
    } catch (err: any) {
      console.error('Git fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGitData();
  }, [workspacePath]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs">
      {/* Header */}
      <div className="h-10 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <GitBranch className="w-4 h-4 text-amber-500" />
          <span>Source Control (Git)</span>
          {status?.branch && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono">
              {status.branch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadGitData}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded"
            title="Refresh Git Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded"
            title="Close Git Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-100 dark:border-blue-900/60 flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Operasi Git di SalamaCode bersifat read-only untuk keamanan repositori Anda.</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-2 pt-1 gap-1">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-3 py-1.5 rounded-t font-medium text-[11px] transition ${
            activeTab === 'status'
              ? 'bg-white dark:bg-slate-900 border-t border-x border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Status {status && !status.clean && `(${status.modified.length + status.untracked.length})`}
        </button>
        <button
          onClick={() => setActiveTab('diff')}
          className={`px-3 py-1.5 rounded-t font-medium text-[11px] transition ${
            activeTab === 'diff'
              ? 'bg-white dark:bg-slate-900 border-t border-x border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Diff View
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-3 py-1.5 rounded-t font-medium text-[11px] transition ${
            activeTab === 'log'
              ? 'bg-white dark:bg-slate-900 border-t border-x border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Commits ({commits.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!status?.isGitRepo ? (
          <div className="p-4 text-center text-slate-400">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <div className="font-medium">Bukan Repositori Git</div>
            <div className="text-[11px] mt-1 text-slate-500">
              Workspace saat ini tidak memiliki folder .git. Anda dapat menjalankan "git init" via terminal bila diperlukan.
            </div>
          </div>
        ) : activeTab === 'status' ? (
          <div className="space-y-4">
            {status.clean ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                <div className="font-semibold text-slate-700 dark:text-slate-300">Working Tree Bersih</div>
                <div className="text-[11px] text-slate-500">Tidak ada perubahan file yang belum di-commit.</div>
              </div>
            ) : (
              <>
                {status.modified.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                      File Dimodifikasi ({status.modified.length})
                    </div>
                    <div className="space-y-1">
                      {status.modified.map((file) => (
                        <div
                          key={file}
                          onClick={() => onOpenFile?.(file)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-200"
                        >
                          <span className="font-mono truncate">{file}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                            M
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {status.untracked.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                      File Baru / Untracked ({status.untracked.length})
                    </div>
                    <div className="space-y-1">
                      {status.untracked.map((file) => (
                        <div
                          key={file}
                          onClick={() => onOpenFile?.(file)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-200"
                        >
                          <span className="font-mono truncate">{file}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                            U
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'diff' ? (
          <div className="h-full">
            {diffText ? (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-500 font-mono">Uncommitted Changes Diff:</div>
                <DiffViewer newContent={diffText} filePath="Workspace Git Diff" />
              </div>
            ) : (
              <div className="text-slate-400 text-center py-8">Tidak ada perbedaan kode untuk ditampilkan.</div>
            )}
          </div>
        ) : (
          /* Commits tab */
          <div className="space-y-2">
            {commits.length === 0 ? (
              <div className="text-slate-400 text-center py-8">Belum ada riwayat commit.</div>
            ) : (
              commits.map((c) => (
                <div
                  key={c.hash}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                      {c.hash.substring(0, 7)}
                    </span>
                    <span className="text-[10px] text-slate-400">{c.date}</span>
                  </div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{c.message}</div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>{c.author}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
