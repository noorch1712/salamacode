/**
 * DeviceService
 * Multi-device management: track desktop, laptop, and browser instances.
 */

import { DeviceItem } from '../../types/index.js';
import { AuthService } from '../auth/AuthService.js';
import { getSupabase, isSupabaseConfigured } from './SupabaseClient.js';

const LOCAL_DEVICE_ID_KEY = 'salama_current_device_id_v1';
const LOCAL_DEVICES_CACHE = 'salama_devices_cache_v1';

export class DeviceService {
  /**
   * Get or generate a persistent unique ID for this device
   */
  static getOrCreateDeviceId(): string {
    let devId = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
    if (!devId) {
      devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(LOCAL_DEVICE_ID_KEY, devId);
    }
    return devId;
  }

  /**
   * Register or update the current device on startup
   */
  static async registerCurrentDevice(): Promise<DeviceItem> {
    const user = AuthService.getCurrentState().user;
    const deviceId = this.getOrCreateDeviceId();

    const isWindows = navigator.userAgent.includes('Windows');
    const isMac = navigator.userAgent.includes('Mac');
    const isLinux = navigator.userAgent.includes('Linux');

    let platform = 'Windows Desktop';
    if (isWindows) platform = 'Windows Desktop';
    else if (isMac) platform = 'macOS';
    else if (isLinux) platform = 'Linux';
    else platform = 'Web Browser';

    const currentDevice: DeviceItem = {
      id: `d_${deviceId}`,
      userId: user?.id || 'local_user',
      deviceId,
      deviceName: isWindows ? 'Acer Windows PC' : 'Workstation',
      platform,
      appVersion: '0.4.0 (Fase 4)',
      isCurrent: true,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('devices').upsert(
          {
            user_id: user.id,
            device_id: deviceId,
            device_name: currentDevice.deviceName,
            platform: currentDevice.platform,
            app_version: currentDevice.appVersion,
            is_current: true,
            last_seen: currentDevice.lastSeen,
          },
          { onConflict: 'user_id,device_id' }
        );
      } catch (err) {
        console.warn('Device registration sync warning:', err);
      }
    }

    // Cache locally
    const devices = await this.listDevices();
    const updated = [
      currentDevice,
      ...devices.filter((d) => d.deviceId !== deviceId).map((d) => ({ ...d, isCurrent: false })),
    ];
    localStorage.setItem(LOCAL_DEVICES_CACHE, JSON.stringify(updated));

    return currentDevice;
  }

  /**
   * List all devices associated with current user
   */
  static async listDevices(): Promise<DeviceItem[]> {
    const user = AuthService.getCurrentState().user;
    const currentId = this.getOrCreateDeviceId();

    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('user_id', user.id)
          .order('last_seen', { ascending: false });

        if (!error && data) {
          return data.map((d) => ({
            id: d.id,
            userId: d.user_id,
            deviceId: d.device_id,
            deviceName: d.device_name,
            platform: d.platform,
            appVersion: d.app_version,
            isCurrent: d.device_id === currentId,
            lastSeen: d.last_seen,
            createdAt: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Could not fetch devices from Supabase, using local cache:', err);
      }
    }

    try {
      const cached = localStorage.getItem(LOCAL_DEVICES_CACHE);
      if (cached) {
        const parsed: DeviceItem[] = JSON.parse(cached);
        return parsed.map((d) => ({
          ...d,
          isCurrent: d.deviceId === currentId,
        }));
      }
    } catch {}

    // Return current device as single fallback
    return [
      {
        id: `d_${currentId}`,
        userId: user?.id || 'local_user',
        deviceId: currentId,
        deviceName: 'Acer Windows PC',
        platform: 'Windows Desktop',
        appVersion: '0.4.0 (Fase 4)',
        isCurrent: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Rename a registered device
   */
  static async renameDevice(deviceId: string, newName: string): Promise<void> {
    if (!newName.trim()) return;

    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase
          .from('devices')
          .update({ device_name: newName.trim(), last_seen: new Date().toISOString() })
          .eq('device_id', deviceId)
          .eq('user_id', user.id);
      } catch {}
    }

    const devices = await this.listDevices();
    const target = devices.find((d) => d.deviceId === deviceId);
    if (target) {
      target.deviceName = newName.trim();
      localStorage.setItem(LOCAL_DEVICES_CACHE, JSON.stringify(devices));
    }
  }

  /**
   * Remove / Sign out a remote device
   */
  static async removeDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    const currentId = this.getOrCreateDeviceId();
    if (deviceId === currentId) {
      return { success: false, message: 'Tidak dapat menghapus perangkat yang sedang Anda gunakan saat ini.' };
    }

    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('devices').delete().eq('device_id', deviceId).eq('user_id', user.id);
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    const devices = await this.listDevices();
    const filtered = devices.filter((d) => d.deviceId !== deviceId);
    localStorage.setItem(LOCAL_DEVICES_CACHE, JSON.stringify(filtered));

    return { success: true, message: 'Perangkat berhasil dikeluarkan.' };
  }
}
