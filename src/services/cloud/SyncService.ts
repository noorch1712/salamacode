/**
 * SyncService
 * Offline Sync Queue, Cloud Settings Synchronization & Conflict Handling.
 * Local-First: works seamlessly offline and syncs safely when online.
 */

import { AppSettings, OfflineSyncQueueItem } from '../../types/index.js';
import { AuthService } from '../auth/AuthService.js';
import { getSupabase, isSupabaseConfigured } from './SupabaseClient.js';
import { desktopBridge } from '../api/desktopBridge.js';
import { sanitizeObject } from '../security/SensitiveDataSanitizer.js';

const OFFLINE_QUEUE_KEY = 'salama_offline_sync_queue_v1';

export class SyncService {
  /**
   * Get pending offline actions
   */
  static getPendingQueue(): OfflineSyncQueueItem[] {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get queue length
   */
  static getQueueLength(): number {
    return this.getPendingQueue().length;
  }

  /**
   * Add an item to the offline sync queue
   */
  static enqueueAction(
    action: OfflineSyncQueueItem['action'],
    payload: any
  ): void {
    // Sanitize any potential sensitive fields
    const cleanPayload = sanitizeObject(payload);
    const queue = this.getPendingQueue();
    const item: OfflineSyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      payload: cleanPayload,
      timestamp: Date.now(),
    };
    queue.push(item);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Flush queue alias for processQueue
   */
  static async flushQueue(): Promise<{ processedCount: number }> {
    return this.processQueue();
  }

  /**
   * Update and store cloud sync preferences
   */
  static async updateCloudSyncPreferences(prefs: {
    syncProjectMetadata?: boolean;
    syncConversationMetadata?: boolean;
    sendAnonymousDiagnostics?: boolean;
  }): Promise<void> {
    try {
      const existingRaw = localStorage.getItem('salama_cloud_sync_prefs_v1');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const merged = { ...existing, ...prefs };
      localStorage.setItem('salama_cloud_sync_prefs_v1', JSON.stringify(merged));
    } catch {}
  }

  /**
   * Process and flush the offline sync queue
   */
  static async processQueue(): Promise<{ processedCount: number }> {
    const queue = this.getPendingQueue();
    if (queue.length === 0) return { processedCount: 0 };

    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      return { processedCount: 0 };
    }

    const user = AuthService.getCurrentState().user;
    if (!user) return { processedCount: 0 };

    let successCount = 0;
    const remaining: OfflineSyncQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === 'update_settings') {
          await supabase.from('user_settings').upsert({
            user_id: user.id,
            theme: item.payload.theme,
            default_provider: item.payload.aiProvider,
            default_model: item.payload.modelName,
            auto_fallback: item.payload.autoFallback,
            ask_before_fallback: item.payload.askBeforeFallback,
            safety_mode: item.payload.safetyMode || item.payload.aiSafetyMode,
            agent_max_iterations: item.payload.maxAgentIterations,
            updated_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return { processedCount: successCount };
  }

  /**
   * Sync user settings to and from cloud, checking for conflicts
   */
  static async syncSettings(
    localSettings: AppSettings
  ): Promise<{
    hasConflict: boolean;
    cloudSettings?: Partial<AppSettings>;
    resolvedSettings?: AppSettings;
  }> {
    const user = AuthService.getCurrentState().user;
    const supabase = getSupabase();

    if (!user || !supabase || !isSupabaseConfigured()) {
      return { hasConflict: false };
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        // First time: push local preferences to cloud (excluding keys!)
        await supabase.from('user_settings').upsert({
          user_id: user.id,
          theme: localSettings.theme || 'light',
          default_provider: localSettings.aiProvider || 'gemini',
          default_model: localSettings.modelName || 'gemini-3.8-flash',
          auto_fallback: localSettings.autoFallback ?? true,
          ask_before_fallback: localSettings.askBeforeFallback ?? true,
          safety_mode: localSettings.safetyMode || 'balanced',
          agent_max_iterations: localSettings.maxAgentIterations || 30,
          updated_at: new Date().toISOString(),
        });
        return { hasConflict: false };
      }

      // Check if there is a divergence between cloud preference and local
      const cloudProvider = data.default_provider;
      const cloudModel = data.default_model;

      if (
        cloudProvider &&
        localSettings.aiProvider &&
        cloudProvider !== localSettings.aiProvider
      ) {
        return {
          hasConflict: true,
          cloudSettings: {
            aiProvider: cloudProvider,
            modelName: cloudModel,
            theme: data.theme,
          },
        };
      }

      return { hasConflict: false };
    } catch {
      return { hasConflict: false };
    }
  }
}
