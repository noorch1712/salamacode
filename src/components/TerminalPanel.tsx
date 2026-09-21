import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  Trash2,
  Minimize2,
  Maximize2,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowDownCircle,
} from 'lucide-react';
import { TerminalOutputLine } from '../types/index.js';
import { desktopBridge } from '../services/api/desktopBridge.js';

interface TerminalPanelProps {
  workspacePath: string;
  outputLines: TerminalOutputLine[];
  onClearOutput: () => void;
  isRunning?: boolean;
  onKillRunning?: () => void;
  onClose?: () => void;
  onRunCustomCommand?: (cmd: string) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  workspacePath,
  outputLines,
  onClearOutput,
  isRunning = false,
  onKillRunning,
  onClose,
  onRunCustomCommand,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [isExecutingManual, setIsExecutingManual] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputLines, autoScroll]);

  const handleRunCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || isRunning || isExecutingManual) return;

    if (onRunCustomCommand) {
      onRunCustomCommand(cmd);
      setCommandInput('');
      return;
    }

    setIsExecutingManual(true);
    try {
      await desktopBridge.runCommand(workspacePath, cmd);
    } catch (err: any) {
      console.error('Command failed:', err);
    } finally {
      setIsExecutingManual(false);
      setCommandInput('');
    }
  };

  const filteredLines = searchFilter
    ? outputLines.filter((l) => l.text.toLowerCase().includes(searchFilter.toLowerCase()))
    : outputLines;

  return (
    <div
      className={`flex flex-col bg-slate-950 border-t border-slate-800 text-slate-200 font-mono text-xs transition-all ${
        isMaximized ? 'h-[500px]' : 'h-64'
      }`}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-slate-300 text-[11px]">Terminal</span>
          <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{workspacePath}</span>

          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 animate-pulse">
              <Clock className="w-3 h-3" />
              Running...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search in output */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Cari output..."
              className="bg-slate-950 text-slate-300 text-[10px] pl-6 pr-2 py-0.5 rounded border border-slate-700 w-28 focus:w-44 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded text-[11px] flex items-center gap-1 ${
              autoScroll ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Auto-scroll"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          {/* Kill Running */}
          {isRunning && (
            <button
              onClick={onKillRunning}
              className="flex items-center gap-1 px-2 py-0.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded text-[10px] transition"
              title="Stop current process"
            >
              <Square className="w-3 h-3" />
              <span>Kill</span>
            </button>
          )}

          {/* Clear output */}
          <button
            onClick={onClearOutput}
            className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-400 rounded transition"
              title="Close Terminal Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 select-text">
        {filteredLines.length === 0 ? (
          <div className="text-slate-600 italic select-none">
            SalamaCode Terminal siap. Command yang dijalankan oleh AI atau input manual akan muncul di sini.
          </div>
        ) : (
          filteredLines.map((line) => {
            if (line.type === 'cmd') {
              return (
                <div key={line.id} className="text-cyan-400 font-bold flex items-start gap-1">
                  <span className="text-slate-500 select-none">$</span>
                  <span>{line.text.replace(/^\$\s*/, '')}</span>
                </div>
              );
            }
            if (line.type === 'stderr') {
              return (
                <div key={line.id} className="text-rose-400 whitespace-pre-wrap break-all pl-3 border-l border-rose-800/60">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'system') {
              return (
                <div key={line.id} className="text-amber-400/90 italic text-[11px] py-0.5">
                  {line.text}
                </div>
              );
            }
            return (
              <div key={line.id} className="text-slate-300 whitespace-pre-wrap break-all pl-3">
                {line.text}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={handleRunCommand}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border-t border-slate-800"
      >
        <span className="text-emerald-400 font-bold select-none">&gt;</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Ketik command terminal (mis: npm test, dir, git status)..."
          disabled={isRunning || isExecutingManual}
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commandInput.trim() || isRunning || isExecutingManual}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded text-[11px] flex items-center gap-1 font-medium transition"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Run</span>
        </button>
      </form>
    </div>
  );
};
