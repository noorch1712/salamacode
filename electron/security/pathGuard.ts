import path from 'path';

export interface PathValidationResult {
  isValid: boolean;
  resolvedPath: string;
  relativePath: string;
  reason?: string;
}

/**
 * Validates that the requested path resides strictly within the workspace root.
 * Protects against directory traversal (e.g. ../../Windows/System32) and arbitrary filesystem access.
 */
export function validateWorkspacePath(
  workspaceRoot: string,
  requestPath: string
): PathValidationResult {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    return {
      isValid: false,
      resolvedPath: '',
      relativePath: '',
      reason: 'Workspace root path is not defined or invalid',
    };
  }

  if (!requestPath || typeof requestPath !== 'string') {
    return {
      isValid: false,
      resolvedPath: '',
      relativePath: '',
      reason: 'Requested path is empty or invalid',
    };
  }

  // Normalize workspace root to eliminate trailing slashes / dot segments
  const normalizedRoot = path.resolve(workspaceRoot);

  // If requestPath is absolute, resolve it; if relative, resolve against workspaceRoot
  const resolvedTarget = path.isAbsolute(requestPath)
    ? path.resolve(requestPath)
    : path.resolve(normalizedRoot, requestPath);

  // Calculate relative path from normalized root to target
  const relative = path.relative(normalizedRoot, resolvedTarget);

  // If relative path starts with '..' or is absolute, it escapes the workspace root!
  const isOutside = relative.startsWith('..') || path.isAbsolute(relative);

  // Additional check: on Windows, drive letters must match
  const rootRoot = path.parse(normalizedRoot).root.toLowerCase();
  const targetRoot = path.parse(resolvedTarget).root.toLowerCase();
  const isDifferentDrive = rootRoot !== targetRoot;

  if (isOutside || isDifferentDrive) {
    return {
      isValid: false,
      resolvedPath: resolvedTarget,
      relativePath: relative,
      reason: `Access denied: Path "${requestPath}" escapes the workspace boundary ("${normalizedRoot}")`,
    };
  }

  // Reject dangerous system paths or null bytes
  if (requestPath.includes('\0')) {
    return {
      isValid: false,
      resolvedPath: resolvedTarget,
      relativePath: relative,
      reason: 'Access denied: Null bytes detected in file path',
    };
  }

  return {
    isValid: true,
    resolvedPath: resolvedTarget,
    relativePath: relative.replace(/\\/g, '/'), // normalize to forward slashes for cross-platform UI
  };
}
