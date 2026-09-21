import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  FolderPlus,
  FilePlus,
  Code2,
} from 'lucide-react';
import { FileNode } from '../types/index.js';

interface FileExplorerProps {
  files: FileNode[];
  activeFilePath: string | null;
  onSelectFile: (node: FileNode) => void;
  onRefresh: () => void;
  onCreateFile: (parentRelPath?: string) => void;
  onCreateFolder: (parentRelPath?: string) => void;
  isLoading?: boolean;
}

function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-500 shrink-0" />;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx')) {
    return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.html')) {
    return <Code2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
  return <File className="w-4 h-4 text-slate-400 shrink-0" />;
}

interface TreeItemProps {
  node: FileNode;
  activeFilePath: string | null;
  onSelectFile: (node: FileNode) => void;
  depth?: number;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  activeFilePath,
  onSelectFile,
  depth = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const isSelected = activeFilePath === node.relativePath;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded cursor-pointer text-xs transition-colors select-none ${
          isSelected
            ? 'bg-blue-100 text-blue-900 font-semibold'
            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
        }`}
        title={node.relativePath}
      >
        {node.isDirectory ? (
          <>
            <span className="text-slate-400 group-hover:text-slate-600 shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(node.name)}
            <span className="truncate">{node.name}</span>
          </>
        )}
      </div>

      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 14 + 16}px` }}
              className="py-1 text-[11px] text-slate-400 italic"
            >
              (kosong)
            </div>
          ) : (
            node.children.map((child) => (
              <TreeItem
                key={child.relativePath}
                node={child}
                activeFilePath={activeFilePath}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-50/70 border-r border-slate-200 select-none">
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white/50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Project Files
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
            {files.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-new-file"
            onClick={() => onCreateFile()}
            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Buat File Baru"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-new-folder"
            onClick={() => onCreateFolder()}
            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Buat Folder Baru"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-refresh-files"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Segarkan Struktur File"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-xs text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Membaca direktori...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <Folder className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-600">Workspace kosong</p>
            <p className="mt-1 text-[11px]">Belum ada file di folder ini.</p>
          </div>
        ) : (
          files.map((file) => (
            <TreeItem
              key={file.relativePath}
              node={file}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>

      {/* Bottom helper */}
      <div className="px-3 py-1.5 border-t border-slate-200 bg-white/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Klik file untuk preview</span>
        <span className="text-[10px]">Read-on-demand</span>
      </div>
    </div>
  );
};
