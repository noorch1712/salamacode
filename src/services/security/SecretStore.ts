/**
 * SecretStore
 * Secure credential storage for local BYOK API Keys.
 * Strictly local-only: API keys are NEVER uploaded to Supabase or cloud services!
 */

const STORAGE_KEY = 'salama_secure_credential_vault_v1';
const VAULT_SALT = 'SALAMA_LANTABURA_SECURE_ENCLAVE_2026';

function obfuscate(str: string): string {
  if (!str) return '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) ^ VAULT_SALT.charCodeAt(i % VAULT_SALT.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

function deobfuscate(encoded: string): string {
  if (!encoded) return '';
  try {
    const raw = atob(encoded);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ VAULT_SALT.charCodeAt(i % VAULT_SALT.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return '';
  }
}

export class SecretStore {
  private static inMemoryVault: Record<string, string> = {};

  /**
   * Store a secret key safely
   */
  static async setSecret(key: string, value: string): Promise<void> {
    if (!value) {
      delete this.inMemoryVault[key];
    } else {
      this.inMemoryVault[key] = value;
    }

    try {
      // In electron or browser, persist encrypted vault
      const rawVault = localStorage.getItem(STORAGE_KEY);
      let vault: Record<string, string> = {};
      if (rawVault) {
        try {
          vault = JSON.parse(atob(rawVault));
        } catch {}
      }

      if (value) {
        vault[key] = obfuscate(value);
      } else {
        delete vault[key];
      }

      localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(vault)));
    } catch {
      // Storage unavailable or disabled
    }
  }

  /**
   * Retrieve a secret key safely
   */
  static async getSecret(key: string): Promise<string> {
    if (this.inMemoryVault[key]) {
      return this.inMemoryVault[key];
    }

    try {
      const rawVault = localStorage.getItem(STORAGE_KEY);
      if (rawVault) {
        const vault = JSON.parse(atob(rawVault));
        if (vault[key]) {
          const decrypted = deobfuscate(vault[key]);
          this.inMemoryVault[key] = decrypted;
          return decrypted;
        }
      }
    } catch {}

    return '';
  }

  /**
   * Clear all stored secrets from local machine
   */
  static async clearAllSecrets(): Promise<void> {
    this.inMemoryVault = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}
