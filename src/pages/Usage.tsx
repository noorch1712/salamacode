/**
 * Usage Page
 * AI Request Metrics, Token Aggregations, and Basic Quota Monitoring.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Calendar,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { UsageService, UsageAggregationResult } from '../services/cloud/UsageService.js';
import { AuthService } from '../services/auth/AuthService.js';
import { DEFAULT_PLANS } from '../services/auth/ProfileService.js';

export const Usage: React.FC = () => {
  const [range, setRange] = useState<'today' | '7days' | '30days'>('today');
  const [stats, setStats] = useState<UsageAggregationResult>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokens: 0,
    byProvider: {},
    dailyBreakdown: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = AuthService.getCurrentState().user;
  const currentPlan = DEFAULT_PLANS[currentUser?.planId || 'free'];

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await UsageService.getAggregatedStats(range);
        setStats(data);
      } catch (err) {
        console.warn('Failed to load usage stats:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [range]);

  const remainingDaily = Math.max(0, currentPlan.dailyRequests - stats.totalRequests);
  const percentUsed = Math.min(100, Math.round((stats.totalRequests / currentPlan.dailyRequests) * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Usage &amp; Quota</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau metrik request AI, penggunaan token, dan alokasi kuota paket harian Anda.
          </p>
        </div>

        {/* Range Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setRange('today')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              range === 'today' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setRange('7days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              range === '7days' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setRange('30days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              range === '30days' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Quota Progress Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-blue-800 tracking-wider">
                Plan: {currentPlan.name}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-full">
                BYOK Mode Enabled
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-1">
              Kuota Harian: {stats.totalRequests} / {currentPlan.dailyRequests} requests
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Sisa Kuota Hari Ini:</span>
            <div className="text-lg font-black text-blue-700">{remainingDaily} requests</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-blue-200/50 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentUsed > 90 ? 'bg-rose-500' : percentUsed > 70 ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 mt-2">
          <span>0 req</span>
          <span>{currentPlan.dailyRequests} req (Batas harian)</span>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Requests</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalRequests}</div>
          <div className="text-[11px] text-slate-400 mt-1">Eksekusi agent &amp; tool calls</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Berhasil</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.successfulRequests}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">
            {stats.totalRequests > 0
              ? `${Math.round((stats.successfulRequests / stats.totalRequests) * 100)}% Success Rate`
              : '100%'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Gagal / Fallback</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{stats.failedRequests}</div>
          <div className="text-[11px] text-slate-400 mt-1">Otomatis dialihkan router</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Tokens</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {stats.totalTokens > 0 ? stats.totalTokens.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Prompt + Completion</div>
        </div>
      </div>

      {/* Provider Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Distribusi Provider AI</h2>
          <p className="text-xs text-slate-500 mb-4">Volume request berdasarkan provider yang digunakan</p>

          <div className="space-y-3.5">
            {['gemini', 'openrouter', 'custom'].map((p) => {
              const count = stats.byProvider[p] || 0;
              const pct = stats.totalRequests > 0 ? Math.round((count / stats.totalRequests) * 100) : 0;
              const name =
                p === 'gemini' ? 'Google Gemini' : p === 'openrouter' ? 'OpenRouter' : 'Custom Local LLM';

              return (
                <div key={p}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{name}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p === 'gemini' ? 'bg-blue-600' : p === 'openrouter' ? 'bg-purple-600' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Local-First Architecture Note */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">Privasi Metrik &amp; BYOK</h2>
            <p className="text-xs text-slate-500 mb-4">
              Bagaimana SalamaCode menangani data penggunaan Anda
            </p>
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                • <strong>Tanpa Data Kode:</strong> Metrik di atas hanya mencatat jumlah request dan durasi. Isi prompt atau cuplikan kode tidak di-upload.
              </p>
              <p>
                • <strong>BYOK Mode:</strong> Saat Anda memasukkan API key sendiri, request dikirim langsung ke provider AI tanpa perantara server SalamaCode.
              </p>
              <p>
                • <strong>Sanitizer Otomatis:</strong> Sebelum telemetry dicatat, secret key seperti token dan kata sandi otomatis disamarkan (redacted).
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Execution Mode:</span>
            <span className="font-bold text-slate-800">BYOK (Bring Your Own Key)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
