/**
 * AuthService
 * Authentication service for SalamaCode with Supabase Auth & Local-First fallback.
 */

import { getSupabase, isSupabaseConfigured } from '../cloud/SupabaseClient.js';
import { UserProfile, UserRole } from '../../types/index.js';
import { sanitizeSensitiveData } from '../security/SensitiveDataSanitizer.js';

export interface AuthState {
  user: UserProfile | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isOfflineMode: boolean;
}

const LOCAL_USER_KEY = 'salama_local_auth_user_v1';
const LOCAL_USERS_DB_KEY = 'salama_local_mock_accounts_db_v1';

// Seed a default mock admin and user for local testing if offline
function getLocalUsersDb(): Record<string, { profile: UserProfile; passwordHash: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaultDb: Record<string, { profile: UserProfile; passwordHash: string }> = {
    'noor@salamacode.com': {
      profile: {
        id: 'user_admin_001',
        email: 'noor@salamacode.com',
        fullName: 'Noor Cholis (Admin)',
        displayName: 'Noor',
        status: 'active',
        planId: 'pro',
        createdAt: '2026-09-01T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        role: 'admin',
      },
      passwordHash: 'admin123',
    },
    'developer@local.test': {
      profile: {
        id: 'user_dev_002',
        email: 'developer@local.test',
        fullName: 'Local Developer',
        displayName: 'Dev',
        status: 'active',
        planId: 'free',
        createdAt: '2026-09-10T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        role: 'user',
      },
      passwordHash: 'developer123',
    },
  };
  try {
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(defaultDb));
  } catch {}
  return defaultDb;
}

export class AuthService {
  private static listeners: ((state: AuthState) => void)[] = [];
  private static currentUser: UserProfile | null = null;
  private static isOffline: boolean = false;

  /**
   * Subscribe to auth state changes
   */
  static onAuthStateChange(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Initial emission
    listener(this.getCurrentState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  static setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    this.notifyListeners();
  }

  private static notifyListeners() {
    const state = this.getCurrentState();
    this.listeners.forEach((l) => l(state));
  }

  static getCurrentState(): AuthState {
    return {
      user: this.currentUser,
      sessionToken: this.currentUser ? 'active_token' : null,
      isAuthenticated: Boolean(this.currentUser),
      isOfflineMode: this.isOffline,
    };
  }

  /**
   * Restore previous session on application startup
   */
  static async initSession(): Promise<AuthState> {
    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session?.user) {
          const user = data.session.user;
          // Fetch profile from supabase profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          // Check if user is admin
          const { data: adminData } = await supabase
            .from('admin_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();

          const role: UserRole = adminData?.role || 'user';

          this.currentUser = {
            id: user.id,
            email: user.email || '',
            fullName: profileData?.full_name || user.user_metadata?.full_name || 'User',
            displayName: profileData?.display_name || user.user_metadata?.display_name || 'User',
            avatarUrl: profileData?.avatar_url,
            status: profileData?.status || 'active',
            planId: profileData?.plan_id || 'free',
            createdAt: user.created_at,
            lastLoginAt: new Date().toISOString(),
            role,
          };
          this.isOffline = false;
          this.notifyListeners();
          return this.getCurrentState();
        }
      } catch (err) {
        console.warn('Supabase auth session check failed:', err);
      }
    }

    // Local session fallback
    try {
      const stored = localStorage.getItem(LOCAL_USER_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.isOffline = false;
        this.notifyListeners();
        return this.getCurrentState();
      }
    } catch {}

    return this.getCurrentState();
  }

  /**
   * Register a new user
   */
  static async register(
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message?: string; user?: UserProfile }> {
    if (!fullName.trim()) return { success: false, message: 'Nama lengkap wajib diisi.' };
    if (!email.trim() || !email.includes('@')) return { success: false, message: 'Email tidak valid.' };
    if (password.length < 6) return { success: false, message: 'Password minimal 6 karakter.' };
    if (password !== confirmPassword) return { success: false, message: 'Konfirmasi password tidak cocok.' };

    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              display_name: fullName.trim().split(' ')[0],
            },
          },
        });

        if (error) {
          return { success: false, message: error.message };
        }

        if (data.user) {
          const newProfile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: fullName.trim(),
            displayName: fullName.trim().split(' ')[0],
            status: 'active',
            planId: 'free',
            createdAt: new Date().toISOString(),
            role: 'user',
          };
          this.currentUser = newProfile;
          this.isOffline = false;
          this.saveLocalSession(newProfile);
          this.notifyListeners();
          return { success: true, user: newProfile };
        }
      } catch (err: any) {
        return { success: false, message: err.message || 'Registrasi gagal pada server Supabase.' };
      }
    }

    // Local-First Fallback Registration
    const localDb = getLocalUsersDb();
    if (localDb[email.toLowerCase()]) {
      return { success: false, message: 'Email sudah terdaftar. Silakan login.' };
    }

    const newLocalUser: UserProfile = {
      id: `usr_${Date.now()}`,
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      displayName: fullName.trim().split(' ')[0],
      status: 'active',
      planId: 'free',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      role: email.toLowerCase().includes('admin') ? 'admin' : 'user',
    };

    localDb[email.toLowerCase()] = {
      profile: newLocalUser,
      passwordHash: password,
    };
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(localDb));

    this.currentUser = newLocalUser;
    this.isOffline = false;
    this.saveLocalSession(newLocalUser);
    this.notifyListeners();

    return {
      success: true,
      message: 'Akun berhasil dibuat.',
      user: newLocalUser,
    };
  }

  /**
   * Login user
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string; user?: UserProfile }> {
    if (!email.trim() || !password) {
      return { success: false, message: 'Email dan password wajib diisi.' };
    }

    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            return { success: false, message: 'Email atau password salah.' };
          }
          return { success: false, message: error.message };
        }

        if (data.user) {
          // Fetch profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const { data: adminData } = await supabase
            .from('admin_roles')
            .select('role')
            .eq('user_id', data.user.id)
            .maybeSingle();

          const role: UserRole = adminData?.role || 'user';

          const userProfile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: profileData?.full_name || 'SalamaCode User',
            displayName: profileData?.display_name || 'User',
            avatarUrl: profileData?.avatar_url,
            status: profileData?.status || 'active',
            planId: profileData?.plan_id || 'free',
            createdAt: data.user.created_at,
            lastLoginAt: new Date().toISOString(),
            role,
          };

          this.currentUser = userProfile;
          this.isOffline = false;
          this.saveLocalSession(userProfile);
          this.notifyListeners();
          return { success: true, user: userProfile };
        }
      } catch (err: any) {
        console.warn('Supabase login failed, trying local fallback:', err);
      }
    }

    // Local-First Fallback Login
    const localDb = getLocalUsersDb();
    const userEntry = localDb[email.toLowerCase().trim()];

    if (!userEntry) {
      return { success: false, message: 'Email atau password salah.' };
    }

    if (userEntry.passwordHash !== password) {
      return { success: false, message: 'Email atau password salah.' };
    }

    if (userEntry.profile.status === 'disabled' || userEntry.profile.status === 'suspended') {
      return { success: false, message: 'Akun Anda sedang dinonaktifkan oleh administrator.' };
    }

    userEntry.profile.lastLoginAt = new Date().toISOString();
    localDb[email.toLowerCase().trim()] = userEntry;
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(localDb));

    this.currentUser = userEntry.profile;
    this.isOffline = false;
    this.saveLocalSession(userEntry.profile);
    this.notifyListeners();

    return {
      success: true,
      user: userEntry.profile,
    };
  }

  /**
   * Continue in local-first offline mode (No account needed)
   */
  static continueOffline(): void {
    this.currentUser = null;
    this.isOffline = true;
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch {}
    this.notifyListeners();
  }

  /**
   * Sign out current user
   */
  static async logout(): Promise<void> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    this.currentUser = null;
    this.isOffline = false;
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch {}
    this.notifyListeners();
  }

  /**
   * Reset Password request
   */
  static async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Email tidak valid.' };
    }
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Instruksi reset password telah dikirim ke email Anda.' };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
    return {
      success: true,
      message: 'Tautan reset password simulasi telah dikirim ke ' + sanitizeSensitiveData(email),
    };
  }

  /**
   * Update current user profile
   */
  static async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!this.currentUser) return null;

    const updated: UserProfile = {
      ...this.currentUser,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updated.fullName,
            display_name: updated.displayName,
            avatar_url: updated.avatarUrl,
            updated_at: updated.updatedAt,
          })
          .eq('id', updated.id);
      } catch {}
    }

    this.currentUser = updated;
    this.saveLocalSession(updated);
    this.notifyListeners();
    return updated;
  }

  private static saveLocalSession(profile: UserProfile) {
    try {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile));
    } catch {}
  }
}
