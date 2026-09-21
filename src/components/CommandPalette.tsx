import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileCode,
  Terminal,
  GitBranch,
  Settings as SettingsIcon,
  RotateCcw,
  Moon,
  Sun,
  FolderOpen,
  Play,
  X,
  FileText,
} from 'lucide-react';
import { FileNode } from '../types/index.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
  onOpenFile: (relativePath: string) => void;
  onOpenTerminal: () => void;
  onOpenSettings: () => void;
  onOpenGit: () => void;
  onOpenBackups: () => void;
  onToggleTheme: () => void;
  onOpenFolderPicker: () => void;
  onRunTestApp: () => void;
  theme: 'light' | 'dark';
}

interface PaletteItem {
  id: string;
  type: 'action' | 'file';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

function flattenFiles(nodes: FileNode[]): { path: string; name: string }[] {
  let list: { path: string; name: string }[] = [];
  for (const node of nodes) {
    if (!node.isDirectory) {
      list.push({ path: node.relativePath, name: node.name });
    }
    if (node.children) {
      list = list.concat(flattenFiles(node.children));
    }
  }
  return list;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  files,
  onOpenFile,
  onOpenTerminal,
  onOpenSettings,
  onOpenGit,
  onOpenBackups,
  onToggleTheme,
  onOpenFolderPicker,
  onRunTestApp,
  theme,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build items
  const allFiles = flattenFiles(files);

  const actions: PaletteItem[] = [
    {
      id: 'act_terminal',
      type: 'action',
      title: 'Buka Terminal Panel',
      subtitle: 'Tampilkan prompt terminal dan log eksekusi',
      icon: <Terminal className="w-4 h-4 text-blue-500" />,
      action: () => {
        onOpenTerminal();
        onClose();
      },
    },
    {
      id: 'act_test',
      type: 'action',
      title: 'Jalankan Final Acceptance Test',
      subtitle: 'Testing otomatis pembuatan project, npm test, dan verifikasi',
      icon: <Play className="w-4 h-4 text-emerald-500 fill-current" />,
      action: () => {
        onRunTestApp();
        onClose();
      },
    },
    {
      id: 'act_git',
      type: 'action',
      title: 'Periksa Git Status & Diff',
      subtitle: 'Lihat file yang diubah dan riwayat commit',
      icon: <GitBranch className="w-4 h-4 text-amber-500" />,
      action: () => {
        onOpenGit();
        onClose();
      },
    },
    {
      id: 'act_backups',
      type: 'action',
      title: 'Riwayat Backup & Rollback File',
      subtitle: 'Kembalikan file ke snapshot sebelum perubahan AI',
      icon: <RotateCcw className="w-4 h-4 text-purple-500" />,
      action: () => {
        onOpenBackups();
        onClose();
      },
    },
    {
      id: 'act_settings',
      type: 'action',
      title: 'Buka Pengaturan (Settings)',
      subtitle: 'Konfigurasi Gemini, OpenRouter, dan Review Mode',
      icon: <SettingsIcon className="w-4 h-4 text-slate-500" />,
      action: () => {
        onOpenSettings();
        onClose();
      },
    },
    {
      id: 'act_theme',
      type: 'action',
      title: `Ganti Tema ke ${theme === 'dark' ? 'Light' : 'Dark'}`,
      subtitle: 'Ubah tampilan antarmuka aplikasi',
      icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />,
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
    {
      id: 'act_folder',
      type: 'action',
      title: 'Ganti Folder Workspace',
      subtitle: 'Pilih direktori project baru di komputer lokal',
      icon: <FolderOpen className="w-4 h-4 text-blue-400" />,
      action: () => {
        onOpenFolderPicker();
        onClose();
      },
    },
  ];

  const fileItems: PaletteItem[] = allFiles.map((f) => ({
    id: `file_${f.path}`,
    type: 'file',
    title: f.name,
    subtitle: f.path,
    icon: <FileCode className="w-4 h-4 text-slate-400" />,
    action: () => {
      onOpenFile(f.path);
      onClose();
    },
  }));

  const filteredItems = [...actions, ...fileItems].filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q));
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-950/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Input box */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Ketik nama file atau perintah (mis: terminal, test, settings)..."
            className="w-full bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              Tidak ada hasil yang cocok dengan "{query}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className={isSelected ? 'text-white' : ''}>{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title}</div>
                    {item.subtitle && (
                      <div
                        className={`text-[11px] truncate ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.type === 'action' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                        isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      Aksi
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span>Navigasi: <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">↓</kbd></span>
            <span>Pilih: <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Enter</kbd></span>
          </div>
          <span>Tutup: <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Esc</kbd></span>
        </div>
      </div>
    </div>
  );
};
