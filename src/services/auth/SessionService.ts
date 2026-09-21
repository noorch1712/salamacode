/**
 * SessionService
 * Manages active user sessions, token refresh cycles, and device context.
 */

import { AuthService, AuthState } from './AuthService.js';
import { UserProfile } from '../../types/index.js';

export class SessionService {
  /**
   * Get current authenticated user or null
   */
  static getCurrentUser(): UserProfile | null {
    return AuthService.getCurrentState().user;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return AuthService.getCurrentState().isAuthenticated;
  }

  /**
   * Check if running in offline mode
   */
  static isOfflineMode(): boolean {
    return AuthService.getCurrentState().isOfflineMode;
  }

  /**
   * Check if current user is admin
   */
  static isAdmin(): boolean {
    const user = this.getCurrentUser();
    return Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));
  }
}
