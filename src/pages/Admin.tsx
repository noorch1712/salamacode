/**
 * Admin Dashboard
 * System Overview, User Management, Cloud Projects Metadata, and Security Audit Logs.
 * Strict Isolation: Admin never sees user passwords, API keys, or source code!
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  FolderCode,
  Activity,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Laptop,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { AdminService } from '../services/cloud/AdminService.js';
import { AdminStatsOverview, AdminUserDetail, AuditLogItem } from '../types/index.js';

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audit'>('overview');
  const [stats, setStats] = useState<AdminStatsOverview>({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    requestsToday: 0,
    errorsToday: 0,
  });
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [overview, userList, logs] = await Promise.all([
        AdminService.getOverviewStats(),
        AdminService.listUsers(searchQuery),
        AdminService.listAuditLogs(),
      ]);
      setStats(overview);
      setUsers(userList);
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Admin load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [searchQuery]);

  const handleToggleStatus = async (user: AdminUserDetail) => {
    const nextStatus = user.profile.status === 'active' ? 'disabled' : 'active';
    await AdminService.toggleUserStatus(user.profile.id, nextStatus);
    await loadAll();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Console</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola pengguna, metrik sistem agregat, dan pantau log audit keamanan.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total Users</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalUsers}</div>
              <div className="text-[11px] text-slate-400 mt-1">Terdaftar di sistem</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Active Users</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{stats.activeUsers}</div>
              <div className="text-[11px] text-slate-400 mt-1">Status aktif</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Cloud Projects</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{stats.totalProjects}</div>
              <div className="text-[11px] text-slate-400 mt-1">Metadata tertaut</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Requests Today</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.requestsToday}</div>
              <div className="text-[11px] text-slate-400 mt-1">AI agent queries</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Errors Today</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{stats.errorsToday}</div>
              <div className="text-[11px] text-slate-400 mt-1">Rate limit / provider err</div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl text-amber-900 text-xs flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="block text-sm">Prinsip Keamanan &amp; Privasi Admin SalamaCode:</strong>
              Admin tidak memiliki akses ke password pengguna (dikelola oleh Supabase Auth), tidak dapat melihat API Key pengguna (disimpan secara lokal via secure store), dan tidak dapat mengakses source code komputer pengguna.
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">Daftar Pengguna Sistem</h2>
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari user (nama / email)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Projects</th>
                  <th className="py-3 px-4">Requests</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.profile.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.profile.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.profile.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                          u.profile.role === 'admin'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.profile.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold uppercase text-[10px] text-blue-700">
                      {u.profile.planId}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{u.projectsCount}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{u.requestsCount}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          u.profile.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {u.profile.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                          u.profile.status === 'active'
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {u.profile.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Security Audit Logs</h2>
            <span className="text-xs text-slate-400">Pencatatan aktivitas sistem terverifikasi</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-[10px] font-bold rounded">
                    {log.eventType}
                  </span>
                  <span className="text-slate-700">
                    {log.details ? JSON.stringify(log.details) : log.entityType || 'Action logged'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
