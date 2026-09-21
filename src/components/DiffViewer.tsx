import React, { useState } from 'react';
import { Columns, AlignJustify, Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  originalContent?: string;
  newContent: string;
  filePath?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalContent = '',
  newContent,
  filePath,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [copied, setCopied] = useState(false);

  // Compute a simple line diff
  const oldLines = originalContent ? originalContent.split('\n') : [];
  const newLines = newContent.split('\n');

  const diffLines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  if (oldLines.length === 0) {
    // Completely new file
    newLines.forEach((line, idx) => {
      diffLines.push({
        type: 'added',
        newLineNumber: idx + 1,
        content: line,
      });
    });
  } else {
    // Simple line-by-line comparison
    const max = Math.max(oldLines.length, newLines.length);
    for (let k = 0; k < max; k++) {
      const o = oldLines[k];
      const n = newLines[k];

      if (o === undefined) {
        diffLines.push({ type: 'added', newLineNumber: k + 1, content: n });
      } else if (n === undefined) {
        diffLines.push({ type: 'removed', oldLineNumber: k + 1, content: o });
      } else if (o !== n) {
        diffLines.push({ type: 'removed', oldLineNumber: k + 1, content: o });
        diffLines.push({ type: 'added', newLineNumber: k + 1, content: n });
      } else {
        diffLines.push({
          type: 'unchanged',
          oldLineNumber: k + 1,
          newLineNumber: k + 1,
          content: o,
        });
      }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(newContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-900 text-slate-100 font-mono text-xs">
      {/* Header controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800">
        <div className="text-slate-400 font-medium truncate max-w-xs">
          {filePath || 'Perubahan Kode'}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700 mr-2">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unified View"
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Split View"
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Salin Konten Baru"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="max-h-[380px] overflow-y-auto overflow-x-auto p-2 leading-5 select-text">
        {viewMode === 'unified' ? (
          <div className="space-y-0.5">
            {diffLines.map((line, idx) => {
              let bg = '';
              let textColor = 'text-slate-300';
              let prefix = ' ';
              if (line.type === 'added') {
                bg = 'bg-emerald-950/60 border-l-2 border-emerald-500 text-emerald-200';
                textColor = 'text-emerald-300';
                prefix = '+';
              } else if (line.type === 'removed') {
                bg = 'bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 line-through opacity-75';
                textColor = 'text-rose-400';
                prefix = '-';
              }

              return (
                <div key={idx} className={`flex items-start px-2 py-0.5 ${bg} rounded-sm`}>
                  <span className="w-8 text-slate-500 select-none text-right pr-2 shrink-0">
                    {line.oldLineNumber || ''}
                  </span>
                  <span className="w-8 text-slate-500 select-none text-right pr-3 shrink-0">
                    {line.newLineNumber || ''}
                  </span>
                  <span className="w-4 select-none font-bold text-slate-400">{prefix}</span>
                  <span className={`whitespace-pre break-all ${textColor}`}>{line.content || ' '}</span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Split View */
          <div className="grid grid-cols-2 gap-2">
            <div className="border-r border-slate-800 pr-2">
              <div className="text-[10px] text-rose-400 font-semibold mb-1 pb-1 border-b border-slate-800">
                Sebelumnya
              </div>
              {oldLines.length === 0 ? (
                <div className="text-slate-500 italic p-2">(File baru, tidak ada riwayat lama)</div>
              ) : (
                oldLines.map((line, idx) => (
                  <div key={idx} className="flex px-1 text-slate-300">
                    <span className="w-6 text-slate-600 select-none pr-2 shrink-0">{idx + 1}</span>
                    <span className="whitespace-pre break-all">{line}</span>
                  </div>
                ))
              )}
            </div>
            <div className="pl-2">
              <div className="text-[10px] text-emerald-400 font-semibold mb-1 pb-1 border-b border-slate-800">
                Perubahan Baru
              </div>
              {newLines.map((line, idx) => (
                <div key={idx} className="flex px-1 text-emerald-200 bg-emerald-950/20">
                  <span className="w-6 text-slate-600 select-none pr-2 shrink-0">{idx + 1}</span>
                  <span className="whitespace-pre break-all">{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
