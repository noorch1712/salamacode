import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Save,
  Copy,
  Check,
  Edit3,
  Eye,
  FileText,
  AlertCircle,
} from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
// Common syntax definitions
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import { FileContent } from '../types/index.js';

interface CodeEditorProps {
  file: FileContent | null;
  onSave: (newContent: string) => Promise<void>;
  isLoading?: boolean;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'markup';
    case 'md':
      return 'markdown';
    case 'sh':
      return 'bash';
    default:
      return 'plaintext';
  }
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  onSave,
  isLoading = false,
}) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setHasChanges(false);
    } else {
      setContent('');
      setHasChanges(false);
    }
  }, [file]);

  useEffect(() => {
    if (file && !isEditing) {
      Prism.highlightAll();
    }
  }, [file, content, isEditing]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!file || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(content);
      setHasChanges(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Shortcut Ctrl+S / Cmd+S
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white p-8 text-center text-slate-400 select-none">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <FileCode className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700 text-sm">Tidak ada file yang dipilih</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          Pilih file dari File Explorer di sebelah kiri untuk melihat isi atau mengedit kode.
        </p>
      </div>
    );
  }

  const language = detectLanguage(file.relativePath);
  const lineCount = content.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Tab & Actions Header */}
      <div className="h-10 px-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate font-mono">
            {file.relativePath}
          </span>
          {hasChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Ada perubahan belum disimpan" />
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-toggle-edit-mode"
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              isEditing
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200'
            }`}
            title={isEditing ? 'Beralih ke mode Preview' : 'Beralih ke mode Edit'}
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'Preview' : 'Edit'}</span>
          </button>

          <button
            id="btn-copy-code"
            onClick={handleCopy}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors"
            title="Salin isi file"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            id="btn-save-file"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors ${
              hasChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            title="Simpan file (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Menyimpan...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="flex-1 overflow-auto bg-slate-50/40 relative font-mono text-xs">
        {isEditing ? (
          <div className="flex h-full min-w-full">
            {/* Line numbers for edit mode */}
            <div className="bg-slate-100/70 border-r border-slate-200 py-3 px-2 text-right text-slate-400 select-none text-xs leading-relaxed shrink-0">
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Textarea for editable code */}
            <textarea
              id="code-editor-textarea"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasChanges(true);
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-3 bg-transparent text-slate-900 resize-none outline-hidden font-mono leading-relaxed text-xs overflow-auto"
              placeholder="Tulis kode di sini..."
            />
          </div>
        ) : (
          <div className="flex min-w-full min-h-full">
            {/* Highlighted view with line numbers */}
            <pre className="!bg-transparent !p-3 !m-0 overflow-visible text-xs leading-relaxed font-mono flex-1">
              <code className={`language-${language}`}>{content}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="h-7 px-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>{lineCount} baris</span>
          <span>•</span>
          <span className="uppercase font-semibold text-slate-600">{language}</span>
          {hasChanges && (
            <span className="text-amber-600 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3" />
              Belum disimpan
            </span>
          )}
        </div>
        <div>
          <span>{isEditing ? 'Mode Edit (Ctrl+S untuk Simpan)' : 'Read-only Preview'}</span>
        </div>
      </div>
    </div>
  );
};
