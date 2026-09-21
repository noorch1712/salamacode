/**
 * apiClient
 * Central helper for building backend API URLs.
 * In web deployment the frontend is static (cPanel) while the backend
 * runs elsewhere; set VITE_API_URL at build time to point to it.
 * Falls back to same-origin (/api) when unset (desktop / local dev).
 */

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || '';

const API_TOKEN: string =
  (import.meta as any).env?.VITE_API_TOKEN || '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return `${API_BASE}${path}`;
}

/** Drop-in fetch wrapper: routes /api/* to the configured backend base URL. */
export function uiFetch(input: string, init?: RequestInit): Promise<Response> {
  const options: RequestInit = { ...(init || {}) };
  if (API_TOKEN) {
    const headers = new Headers(options.headers || {});
    headers.set('X-Api-Token', API_TOKEN);
    options.headers = headers;
  }
  return fetch(apiUrl(input), options);
}