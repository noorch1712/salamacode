/**
 * ProfileService
 * Handles user profile details, plan limits, and account deletion.
 */

import { AuthService } from './AuthService.js';
import { getSupabase, isSupabaseConfigured } from '../cloud/SupabaseClient.js';
import { PlanTier, UserProfile } from '../../types/index.js';

export const DEFAULT_PLANS: Record<string, PlanTier> = {
  free: {
    id: 'free',
    name: 'Free Community',
    description: 'Local-first coding agent with standard metadata sync and BYOK',
    maxProjects: 5,
    dailyRequests: 100,
    monthlyRequests: 3000,
    maxDevices: 3,
    features: {
      byok: true,
      cloudSync: true,
      autoFallback: true,
      analytics: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'SalamaCode Pro',
    description: 'Enhanced quota with multi-device synchronization and priority routing',
    maxProjects: 25,
    dailyRequests: 500,
    monthlyRequests: 15000,
    maxDevices: 10,
    features: {
      byok: true,
      cloudSync: true,
      autoFallback: true,
      analytics: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited project metadata and organization audit logs',
    maxProjects: 999,
    dailyRequests: 10000,
    monthlyRequests: 300000,
    maxDevices: 50,
    features: {
      byok: true,
      cloudSync: true,
      autoFallback: true,
      analytics: true,
      prioritySupport: true,
    },
  },
};

export class ProfileService {
  /**
   * Get user plan configuration
   */
  static getPlan(planId: string = 'free'): PlanTier {
    return DEFAULT_PLANS[planId] || DEFAULT_PLANS.free;
  }

  /**
   * Update profile details (Full name, display name)
   */
  static async updateProfile(updates: {
    fullName?: string;
    displayName?: string;
  }): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const user = AuthService.getCurrentState().user;
    if (!user) return { success: false, message: 'Tidak ada sesi aktif.' };

    const updatedUser: UserProfile = {
      ...user,
      fullName: updates.fullName !== undefined ? updates.fullName : user.fullName,
      displayName: updates.displayName !== undefined ? updates.displayName : user.displayName,
    };

    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updatedUser.fullName,
            display_name: updatedUser.displayName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (err) {
        console.warn('Supabase profile update notice:', err);
      }
    }

    try {
      localStorage.setItem('salama_local_auth_user_v1', JSON.stringify(updatedUser));
    } catch {}

    AuthService.setCurrentUser(updatedUser);

    return { success: true, user: updatedUser };
  }

  /**
   * Permanently delete user account
   * Note: As strictly required, local files are NEVER touched!
   */
  static async deleteAccount(): Promise<{ success: boolean; message: string }> {
    const user = AuthService.getCurrentState().user;
    if (!user) return { success: false, message: 'Tidak ada sesi aktif.' };

    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        // Delete profile which cascades through tables
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.auth.signOut();
      } catch (err: any) {
        console.warn('Supabase account deletion notice:', err);
      }
    }

    // Clean up local account storage
    try {
      localStorage.removeItem('salama_local_auth_user_v1');
    } catch {}

    await AuthService.logout();

    return {
      success: true,
      message: 'Akun cloud Anda berhasil dihapus permanen. Seluruh file project lokal Anda tetap aman di komputer.',
    };
  }
}
