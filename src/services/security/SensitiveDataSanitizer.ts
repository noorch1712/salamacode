/**
 * SensitiveDataSanitizer
 * Sanitizes tokens, API keys, passwords, and private credentials before
 * any telemetry, audit logging, or cloud metadata sync.
 */

// Common patterns for secrets and keys
const PATTERNS: { regex: RegExp; replacement: string }[] = [
  // Google Gemini API Keys (AIzaSy...)
  {
    regex: /AIzaSy[A-Za-z0-9_-]{33}/g,
    replacement: 'AIzaSy[REDACTED_GEMINI_KEY]',
  },
  // OpenAI & OpenRouter Keys (sk-...)
  {
    regex: /sk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}/g,
    replacement: 'sk-[REDACTED_API_KEY]',
  },
  // Bearer Tokens
  {
    regex: /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  // Database passwords in URIs (e.g. postgres://user:password@host...)
  {
    regex: /(:\/\/[^:]+:)([^@]+)(@)/g,
    replacement: '$1[REDACTED_PASSWORD]$3',
  },
  // Private keys block
  {
    regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----[^-]+-----END (?:RSA )?PRIVATE KEY-----/gs,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  // Password fields in JSON-like strings
  {
    regex: /"(password|secret|apiKey|apiKeyHash|token)":\s*"[^"]+"/gi,
    replacement: '"$1":"[REDACTED]"',
  },
];

export function sanitizeSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;
  for (const { regex, replacement } of PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

export function sanitizeObject<T>(data: T): T {
  if (!data) return data;
  if (typeof data === 'string') {
    return sanitizeSensitiveData(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeObject(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const copy: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        ['password', 'apiKey', 'secret', 'geminiApiKey', 'openRouterApiKey', 'customProviderApiKey'].includes(
          key
        )
      ) {
        copy[key] = value ? '[REDACTED]' : value;
      } else {
        copy[key] = sanitizeObject(value);
      }
    }
    return copy as T;
  }
  return data;
}
