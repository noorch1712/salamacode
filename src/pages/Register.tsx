/**
 * Register Page
 * User Account Registration with validation and local-first fallback.
 */

import React, { useState } from 'react';
import { Sparkles, ArrowRight, User, Mail, Lock, AlertCircle, Laptop, CheckCircle } from 'lucide-react';
import { AuthService } from '../services/auth/AuthService.js';
import { UserProfile } from '../types/index.js';

interface RegisterProps {
  onSuccess: (user: UserProfile) => void;
  onNavigateLogin: () => void;
  onContinueOffline: () => void;
}

export const Register: React.FC<RegisterProps> = ({
  onSuccess,
  onNavigateLogin,
  onContinueOffline,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak sama.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await AuthService.register(fullName, email, password, confirmPassword);
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setErrorMessage(res.message || 'Gagal mendaftar. Silakan coba lagi.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan pada pendaftaran.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between select-none">
      {/* Top Brand Bar */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">SalamaCode</span>
            <span className="ml-2 text-[10px] uppercase font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
              Fase 4 • User Account
            </span>
          </div>
        </div>

        <button
          onClick={onContinueOffline}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <Laptop className="w-3.5 h-3.5 text-slate-500" />
          <span>Continue Offline</span>
        </button>
      </div>

      {/* Main Register Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3 shadow-xs">
              <User className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Buat Akun SalamaCode</h1>
            <p className="text-xs text-slate-500 mt-1">
              Mulai sinkronisasi metadata dan kelola multi-device dengan aman.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 focus:bg-white text-slate-800 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 focus:bg-white text-slate-800 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 focus:bg-white text-slate-800 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 focus:bg-white text-slate-800 transition-all"
                />
              </div>
            </div>

            {/* Privacy note */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-snug">
              <strong>Local-First Guarantee:</strong> Source code project Anda tidak pernah diunggah otomatis ke cloud. Hanya metadata dan preferensi yang disinkronkan.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoading ? 'Mendaftarkan Akun...' : 'Buat Akun'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Sudah punya akun?</span>
            <button
              onClick={onNavigateLogin}
              className="font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Masuk Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white/70">
        Created &amp; Powered by <strong className="text-slate-700">PT Salama Lantabura Int.</strong>
      </footer>
    </div>
  );
};
