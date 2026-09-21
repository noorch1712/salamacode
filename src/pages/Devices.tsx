/**
 * Devices Page
 * Multi-device management: Rename, sign out remote instances, and monitor active sessions.
 */

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Monitor,
  Smartphone,
  ShieldCheck,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { DeviceItem } from '../types/index.js';
import { DeviceService } from '../services/cloud/DeviceService.js';

export const Devices: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const list = await DeviceService.listDevices();
      setDevices(list);
    } catch (err) {
      console.warn('Devices fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleStartRename = (dev: DeviceItem) => {
    setEditingId(dev.deviceId);
    setEditName(dev.deviceName);
  };

  const handleSaveRename = async (deviceId: string) => {
    if (!editName.trim()) return;
    await DeviceService.renameDevice(deviceId, editName.trim());
    setEditingId(null);
    setStatusMessage('Nama perangkat berhasil diperbarui.');
    setTimeout(() => setStatusMessage(null), 3000);
    await loadDevices();
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm('Apakah Anda yakin ingin mengeluarkan perangkat ini dari sesi akun Anda?')) {
      return;
    }
    const res = await DeviceService.removeDevice(deviceId);
    if (res.success) {
      setStatusMessage('Perangkat berhasil dikeluarkan.');
      setTimeout(() => setStatusMessage(null), 3000);
      await loadDevices();
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Perangkat Terhubung</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola komputer desktop, laptop, dan workstation yang terhubung dengan akun SalamaCode Anda.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          Total: {devices.length} Perangkat
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Devices List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((dev) => (
          <div
            key={dev.deviceId}
            className={`bg-white rounded-3xl p-5 border transition-all ${
              dev.isCurrent
                ? 'border-blue-400 ring-2 ring-blue-100 shadow-xs'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    dev.isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {dev.platform.includes('Windows') ? (
                    <Monitor className="w-5 h-5" />
                  ) : (
                    <Laptop className="w-5 h-5" />
                  )}
                </div>

                <div>
                  {editingId === dev.deviceId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 text-xs border border-blue-400 rounded-lg outline-hidden font-bold text-slate-800"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(dev.deviceId)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">{dev.deviceName}</h3>
                      <button
                        onClick={() => handleStartRename(dev)}
                        title="Ubah nama perangkat"
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{dev.platform}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-400">Versi {dev.appVersion}</span>
                  </div>
                </div>
              </div>

              {dev.isCurrent ? (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Perangkat Ini
                </span>
              ) : (
                <button
                  onClick={() => handleRemoveDevice(dev.deviceId)}
                  title="Keluarkan Perangkat"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Aktif: {dev.isCurrent ? 'Sekarang' : new Date(dev.lastSeen).toLocaleString()}</span>
              <span className="font-mono text-[10px] text-slate-400">
                ID: {dev.deviceId.substring(0, 12)}...
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl text-xs text-slate-500 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800 block">Kebijakan Keamanan Perangkat:</strong>
          Mengeluarkan perangkat dari daftar di atas akan membatalkan sesi sinkronisasi cloud pada komputer tersebut. Berkas source code project lokal di komputer tersebut <strong>tidak akan dihapus</strong>.
        </div>
      </div>
    </div>
  );
};
