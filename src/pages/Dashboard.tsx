/**
 * Dashboard Page
 * User Account Portal & Overview of Projects, Usage, and Devices.
 */

import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  Sparkles,
  Cloud,
  Cpu,
  Laptop,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Star,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { CloudProject, UserProfile, WorkspaceInfo } from '../types/index.js';
import { ProjectService } from '../services/cloud/ProjectService.js';
import { UsageService } from '../services/cloud/UsageService.js';
import { DeviceService } from '../services/cloud/DeviceService.js';

interface DashboardProps {
  user: UserProfile | null;
  onOpenWorkspacePath: (path: string) => void;
  onNavigateTab: (tab: string) => void;
  onOpenFolderPicker: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onOpenWorkspacePath,
  onNavigateTab,
  onOpenFolderPicker,
}) => {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [todayRequests, setTodayRequests] = useState<number>(0);
  const [devicesCount, setDevicesCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const projs = await ProjectService.listProjects();
        setProjects(projs);

        const stats = await UsageService.getAggregatedStats('today');
        setTodayRequests(stats.totalRequests);

        const devs = await DeviceService.listDevices();
        setDevicesCount(devs.length);
      } catch (err) {
        console.warn('Dashboard data load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Selamat datang kembali, {user?.displayName || user?.fullName || 'Developer'}! 👋
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Plan: {user?.planId || 'Free'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            SalamaCode Local-First Agent siap membantu pengembangan Anda. Kode sumber tetap aman di komputer lokal Anda, sementara preferensi dan metadata disinkronkan.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenFolderPicker}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Buka Local Workspace</span>
          </button>
          <button
            onClick={() => onNavigateTab('projects')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Kelola Project</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Cloud Projects</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{projects.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Metadata tersinkronisasi</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">AI Requests Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{todayRequests}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Kuota harian: 100 req</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Perangkat Terdaftar</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{devicesCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Desktop &amp; Laptop Aktif</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">AI Architecture</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1">BYOK + Smart Router</div>
          <div className="text-[11px] text-slate-400 mt-1">Gemini &amp; OpenRouter</div>
        </div>
      </div>

      {/* Recent Projects Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Project Terakhir Anda</h2>
            <p className="text-xs text-slate-500">Pilih project untuk langsung bekerja di Coding Agent IDE</p>
          </div>
          <button
            onClick={() => onNavigateTab('projects')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua ({projects.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <Code2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-xs font-semibold text-slate-600">Belum ada project tertaut ke cloud</div>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Buka folder project di komputer Anda atau tautkan folder yang ada untuk menyimpan metadata.
            </p>
            <button
              onClick={onOpenFolderPicker}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Pilih Folder Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((proj) => (
              <div
                key={proj.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                        {proj.name}
                      </div>
                    </div>
                    {proj.isFavorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>

                  {proj.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{proj.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                      {proj.framework || 'General'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded">
                      {proj.language || 'Code'}
                    </span>
                    {proj.gitBranch && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded">
                        {proj.gitBranch}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {new Date(proj.lastOpenedAt).toLocaleDateString()}
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
                    <span>Buka Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
