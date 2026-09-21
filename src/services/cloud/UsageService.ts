/**
 * UsageService
 * Cloud and Local Usage Tracking, Quota Enforcement & Aggregation.
 * Strictly avoids fake stats: if token count is unavailable, keeps it null.
 */

import { AIUsageLogItem, UserProfile } from '../../types/index.js';
import { AuthService } from '../auth/AuthService.js';
import { DEFAULT_PLANS } from '../auth/ProfileService.js';
import { getSupabase, isSupabaseConfigured } from './SupabaseClient.js';
import { desktopBridge } from '../api/desktopBridge.js';
import { uiFetch } from '../api/apiClient.js';

export interface UsageAggregationResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  byProvider: Record<string, number>;
  dailyBreakdown: { date: string; requests: number; errors: number; tokens: number }[];
}

export class UsageService {
  /**
   * Check if current user has reached their plan's daily quota
   * (Requirement 34: "Daily AI quota reached. You can: • wait until quota resets • use your own provider/API key")
   */
  static async checkDailyQuota(): Promise<{ allowed: boolean; remaining: number; limit: number; message?: string }> {
    const user = AuthService.getCurrentState().user;
    const plan = DEFAULT_PLANS[user?.planId || 'free'];
    const limit = plan.dailyRequests;

    const stats = await this.getAggregatedStats('today');
    const used = stats.totalRequests;

    if (used >= limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        message:
          'Daily AI quota reached for Free Community plan. You can wait until quota resets tomorrow or use your own custom provider / BYOK API Key.',
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - used),
      limit,
    };
  }

  /**
   * Log an AI execution usage event
   */
  static async logUsage(item: AIUsageLogItem, projectId?: string): Promise<void> {
    const user = AuthService.getCurrentState().user;

    // 1. Send to local server / telemetry endpoint
    try {
      await uiFetch('/api/ai/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch {}

    // 2. Sync aggregated record to Supabase if logged in
    const supabase = getSupabase();
    if (user && supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('usage_logs').insert({
          user_id: user.id,
          project_id: projectId || null,
          provider: item.provider,
          model: item.model,
          request_type: item.requestType || 'chat',
          requests: 1,
          successful_requests: item.status === 'SUCCESS' ? 1 : 0,
          failed_requests: item.status !== 'SUCCESS' ? 1 : 0,
          input_tokens: item.inputTokens || null,
          output_tokens: item.outputTokens || null,
          duration_ms: item.durationMs || 0,
          status: item.status,
          error_type: item.errorType || null,
        });
      } catch (err) {
        console.warn('Supabase usage logging notice:', err);
      }
    }
  }

  /**
   * Get usage aggregation for Today, 7 Days, or 30 Days
   */
  static async getAggregatedStats(
    range: 'today' | '7days' | '30days' = 'today'
  ): Promise<UsageAggregationResult> {
    let logs: AIUsageLogItem[] = [];

    // Fetch from local server telemetry
    try {
      const res = await uiFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        logs = data.logs || [];
      }
    } catch {}

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let cutoff = now - dayMs;
    if (range === '7days') cutoff = now - 7 * dayMs;
    if (range === '30days') cutoff = now - 30 * dayMs;

    // Filter within cutoff
    const filtered = logs.filter((l) => l.timestamp >= cutoff);

    let totalRequests = filtered.length;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalTokens = 0;
    const byProvider: Record<string, number> = {
      gemini: 0,
      openrouter: 0,
      custom: 0,
    };

    const daysMap: Record<string, { requests: number; errors: number; tokens: number }> = {};

    filtered.forEach((item) => {
      if (item.status === 'SUCCESS') successfulRequests++;
      else failedRequests++;

      const pKey = item.provider.toLowerCase();
      byProvider[pKey] = (byProvider[pKey] || 0) + 1;

      const tokens = (item.inputTokens || 0) + (item.outputTokens || 0);
      totalTokens += tokens;

      const dateStr = new Date(item.timestamp).toISOString().split('T')[0];
      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { requests: 0, errors: 0, tokens: 0 };
      }
      daysMap[dateStr].requests++;
      if (item.status !== 'SUCCESS') daysMap[dateStr].errors++;
      daysMap[dateStr].tokens += tokens;
    });

    const dailyBreakdown = Object.entries(daysMap)
      .map(([date, val]) => ({
        date,
        ...val,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      byProvider,
      dailyBreakdown,
    };
  }
}
