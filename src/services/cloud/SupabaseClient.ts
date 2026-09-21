/**
 * SupabaseClient
 * Local-First Supabase Client with graceful offline fallback.
 * Uses SUPABASE_URL and SUPABASE_ANON_KEY.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve credentials from Vite environment or window runtime
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.SUPABASE_URL || '';
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;
let isConfiguredFlag = false;

// Check if valid URL and Key are provided
if (envUrl && envKey && !envUrl.includes('placeholder') && envUrl.startsWith('http')) {
  try {
    supabaseInstance = createClient(envUrl, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    isConfiguredFlag = true;
  } catch (err) {
    console.warn('Supabase initialization failed:', err);
  }
}

export const isSupabaseConfigured = (): boolean => isConfiguredFlag;

export const getSupabase = (): SupabaseClient | null => supabaseInstance;

/**
 * Configure or update Supabase credentials dynamically (e.g., from settings modal)
 */
export function initSupabase(url: string, anonKey: string): boolean {
  if (!url || !anonKey || !url.startsWith('http')) {
    return false;
  }
  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    isConfiguredFlag = true;
    return true;
  } catch (err) {
    console.error('Failed to configure Supabase:', err);
    return false;
  }
}
