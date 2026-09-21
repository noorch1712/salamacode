import { CommandSecurityLevel } from '../../src/types/index.js';

const BLOCKED_PATTERNS = [
  /format\s+[a-z]:/i,
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /rm\s+-rf\s+[\/\\](?:\s|$)/,
  /del\s+\/[sfq]\s+c:\\/i,
  /curl.*\|\s*(?:bash|sh)/i,
  /wget.*\|\s*(?:bash|sh)/i,
  /chmod\s+-R\s+777\s+[\/\\]/,
  /\.ssh/i,
  /id_rsa/i,
  /passwd/i,
  /shadow/i,
  /powershell.*-enc/i,
  /certutil/i,
  /reg\s+(?:add|delete)/i,
];

const APPROVAL_REQUIRED_PATTERNS = [
  /npm\s+uninstall/i,
  /yarn\s+remove/i,
  /pnpm\s+remove/i,
  /git\s+reset/i,
  /git\s+checkout/i,
  /git\s+clean/i,
  /git\s+restore/i,
  /composer\s+remove/i,
  /pip\s+uninstall/i,
  /python(?:\d)?\s+/i,
  /node\s+-e/i,
  /rm\s+/i,
  /del\s+/i,
  /rmdir/i,
];

export function evaluateCommandSecurity(command: string): {
  level: CommandSecurityLevel;
  reason?: string;
} {
  const trimmed = command.trim();

  // Check for blocked commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: 'BLOCKED_BY_DEFAULT',
        reason: `Command "${trimmed}" terdeteksi berbahaya dan diblokir demi keamanan sistem.`,
      };
    }
  }

  // Check for approval-required commands
  for (const pattern of APPROVAL_REQUIRED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: 'APPROVAL_REQUIRED',
        reason: `Command "${trimmed}" dapat mengubah dependensi atau file git/sistem dan membutuhkan persetujuan pengguna.`,
      };
    }
  }

  // Standard development commands are safe within workspace
  return {
    level: 'SAFE',
  };
}
