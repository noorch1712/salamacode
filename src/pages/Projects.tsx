/**
 * Projects Management Page
 * Local and Cloud Project View, Linking, Technology Detection, and Metadata Management.
 */

import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Search,
  Cloud,
  Laptop,
  Star,
  Archive,
  Trash2,
  ExternalLink,
  Plus,
  ArrowRight,
  Code2,
  AlertTriangle,
  GitBranch,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { CloudProject, WorkspaceInfo } from '../types/index.js';
import { ProjectService } from '../services/cloud/ProjectService.js';
import { desktopBridge } from '../services/api/desktopBridge.js';

interface ProjectsPageProps {
  onOpenWorkspacePath: (path: string) => void;
  onOpenFolderPicker: () => void;
  currentWorkspacePath?: string;
}

export const Projects: React.FC<ProjectsPageProps> = ({
  onOpenWorkspacePath,
  onOpenFolderPicker,
  currentWorkspacePath,
}) => {
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [localPresets, setLocalPresets] = useState<WorkspaceInfo[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'cloud' | 'local' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Link to Cloud Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkPath, setLinkPath] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<CloudProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [projs, presets] = await Promise.all([
        ProjectService.listProjects(),
        desktopBridge.listPresetWorkspaces ? desktopBridge.listPresetWorkspaces() : [],
      ]);
      setCloudProjects(projs);
      setLocalPresets(presets);
    } catch (err) {
      console.warn('Projects load failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkPath.trim() || !linkName.trim()) return;

    setIsLinking(true);
    try {
      await ProjectService.linkProject(linkPath.trim(), linkName.trim(), linkDesc.trim());
      setShowLinkModal(false);
      setLinkPath('');
      setLinkName('');
      setLinkDesc('');
      await loadAll();
    } catch (err: any) {
      alert(`Gagal menautkan project: ${err.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await ProjectService.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } catch (err: any) {
      alert(`Gagal menghapus metadata project: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    await ProjectService.toggleFavorite(id);
    await loadAll();
  };

  const handleToggleArchive = async (id: string) => {
    await ProjectService.toggleArchive(id);
    await loadAll();
  };

  // Filter and search logic
  const filteredCloud = cloudProjects.filter((p) => {
    if (activeFilter === 'archived') return p.archived;
    if (p.archived) return false;
    if (activeFilter === 'local') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.framework && p.framework.toLowerCase().includes(q)) ||
        (p.language && p.language.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredLocal = localPresets.filter((lp) => {
    if (activeFilter === 'archived' || activeFilter === 'cloud') return false;
    if (searchQuery.trim()) {
      return lp.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Project Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola project lokal Anda dan sinkronkan metadata ke cloud tanpa mengekspos kode sumber.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLinkPath(currentWorkspacePath || 'workspaces/TestApp');
              setLinkName(currentWorkspacePath ? currentWorkspacePath.split(/[\\/]/).pop() || '' : 'TestApp');
              setShowLinkModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Link Project to Cloud</span>
          </button>
          <button
            onClick={onOpenFolderPicker}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Buka Folder Lokal</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Projects
          </button>
          <button
            onClick={() => setActiveFilter('cloud')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeFilter === 'cloud'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ☁ Cloud Linked
          </button>
          <button
            onClick={() => setActiveFilter('local')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeFilter === 'local'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💻 Local Only
          </button>
          <button
            onClick={() => setActiveFilter('archived')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeFilter === 'archived'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archived
          </button>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari project..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cloud-Linked Projects */}
        {filteredCloud.map((proj) => (
          <div
            key={proj.id}
            className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-blue-300 shadow-xs transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                      {proj.name}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {proj.localPath || 'Linked Cloud'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleFavorite(proj.id)}
                    title="Favorit"
                    className="p-1 text-slate-400 hover:text-amber-500 cursor-pointer transition-colors"
                  >
                    <Star
                      className={`w-4 h-4 ${proj.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => handleToggleArchive(proj.id)}
                    title={proj.archived ? 'Pulihkan' : 'Arsipkan'}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(proj)}
                    title="Hapus Metadata Cloud"
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {proj.description && (
                <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">{proj.description}</p>
              )}

              {/* Badges */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-md">
                  {proj.framework || 'React / Vite'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md">
                  {proj.language || 'TypeScript'}
                </span>
                {proj.gitBranch && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded-md">
                    <GitBranch className="w-3 h-3 text-slate-400" />
                    <span>{proj.gitBranch}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                Terakhir: {new Date(proj.lastOpenedAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  if (proj.localPath) {
                    onOpenWorkspacePath(proj.localPath);
                  } else {
                    onOpenFolderPicker();
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <span>Buka IDE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Local Only Projects */}
        {filteredLocal.map((lp, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 group-hover:text-slate-700 truncate">
                      {lp.name}
                    </h3>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{lp.path}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setLinkPath(lp.path);
                    setLinkName(lp.name);
                    setShowLinkModal(true);
                  }}
                  title="Tautkan ke Cloud"
                  className="px-2 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors"
                >
                  Link ☁
                </button>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mt-3 text-[11px] text-slate-500">
                Local Only Workspace • Berkas berada di komputer Anda.
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Local Disk</span>
              <button
                onClick={() => onOpenWorkspacePath(lp.path)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-blue-600 cursor-pointer"
              >
                <span>Buka Local</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Link to Cloud Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Link Project to Cloud</h3>
                <p className="text-[11px] text-slate-500">Simpan metadata &amp; deteksi framework otomatis</p>
              </div>
            </div>

            <form onSubmit={handleLinkSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Project</label>
                <input
                  type="text"
                  required
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Contoh: SINDIKASI"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Local Workspace Path</label>
                <input
                  type="text"
                  required
                  value={linkPath}
                  onChange={(e) => setLinkPath(e.target.value)}
                  placeholder="Contoh: workspaces/TestApp atau C:\Projects\App"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi (Opsional)</label>
                <textarea
                  value={linkDesc}
                  onChange={(e) => setLinkDesc(e.target.value)}
                  rows={2}
                  placeholder="Deskripsi singkat project..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800">
                <strong>Prinsip Local-First:</strong> Kode sumber Anda TIDAK akan diunggah ke cloud. Cloud hanya menyimpan nama, metadata teknologi, dan preferensi AI.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLinking}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {isLinking ? 'Menautkan...' : 'Tautkan Metadata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Requirement 26) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">Hapus Metadata Cloud Project?</h3>
            <div className="mt-2 text-xs text-slate-600 space-y-2">
              <p>
                Anda akan menghapus metadata cloud untuk <strong>{deleteTarget.name}</strong>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold text-[11px]">
                ⚠️ PERHATIAN LOCAL-FIRST:
                <br />
                Tindakan ini HANYA menghapus metadata di cloud. Seluruh berkas source code lokal Anda di{' '}
                <span className="font-mono">{deleteTarget.localPath || 'komputer'}</span>{' '}
                <strong>TIDAK AKAN DIHAPUS</strong>.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Metadata Cloud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
