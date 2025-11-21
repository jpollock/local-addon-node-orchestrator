/**
 * Security validation module for Node.js Orchestrator addon
 * Prevents command injection, path traversal, and validates user input
 */

import * as path from 'path';

/**
 * Allowed commands and their permitted subcommands
 */
const AllowedCommands = {
  npm: ['start', 'run', 'install', 'build', 'test', 'dev', 'ci'],
  yarn: ['start', 'run', 'install', 'build', 'test', 'dev'],
  pnpm: ['start', 'run', 'install', 'build', 'test', 'dev'],
  node: true, // Allow node with any script file
  bun: ['start', 'run', 'install', 'build', 'test', 'dev'],
} as const;

export interface CommandValidationResult {
  valid: boolean;
  sanitizedCommand?: string[];
  error?: string;
}

/**
 * Validates a start/install/build command to prevent command injection
 *
 * @param command - The command string to validate
 * @returns Validation result with sanitized command or error
 */
export function validateCommand(command: string): CommandValidationResult {
  if (!command || typeof command !== 'string') {
    return {
      valid: false,
      error: 'Command must be a non-empty string'
    };
  }

  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    return {
      valid: false,
      error: 'Command cannot be empty'
    };
  }

  // Check for dangerous characters that could enable command injection
  // Disallow: ; & | ` $ ( ) < > \ " '
  const dangerousChars = /[;&|`$()<>\\'"]/;
  if (dangerousChars.test(trimmedCommand)) {
    return {
      valid: false,
      error: 'Command contains potentially dangerous characters (;, &, |, `, $, (), <>, \\, quotes)'
    };
  }

  // Split command into parts
  const parts = trimmedCommand.split(/\s+/);
  const [executable, ...args] = parts;

  // Validate executable
  const allowedExecutables = Object.keys(AllowedCommands);
  if (!allowedExecutables.includes(executable)) {
    return {
      valid: false,
      error: `Executable '${executable}' is not allowed. Only ${allowedExecutables.join(', ')} are permitted.`
    };
  }

  // Validate subcommands for package managers
  if (executable === 'npm' || executable === 'yarn' || executable === 'pnpm' || executable === 'bun') {
    const subcommand = args[0];
    const allowed = AllowedCommands[executable as keyof typeof AllowedCommands];

    if (!subcommand) {
      return {
        valid: false,
        error: `${executable} requires a subcommand (e.g., ${executable} start)`
      };
    }

    if (Array.isArray(allowed) && !allowed.includes(subcommand)) {
      return {
        valid: false,
        error: `Subcommand '${subcommand}' is not allowed for ${executable}. Allowed: ${allowed.join(', ')}`
      };
    }
  }

  // For node command, validate the script path doesn't contain suspicious patterns
  if (executable === 'node' && args[0]) {
    const scriptPath = args[0];

    // Check for path traversal attempts
    if (scriptPath.includes('..')) {
      return {
        valid: false,
        error: 'Node script path cannot contain ".." (path traversal attempt detected)'
      };
    }

    // Script should be a relative path or filename
    if (scriptPath.startsWith('/')) {
      return {
        valid: false,
        error: 'Node script must be a relative path, not an absolute path'
      };
    }
  }

  return {
    valid: true,
    sanitizedCommand: [executable, ...args]
  };
}

/**
 * Validates a start command specifically
 */
export function validateStartCommand(command: string): CommandValidationResult {
  return validateCommand(command);
}

/**
 * Validates an install command specifically
 */
export function validateInstallCommand(command: string): CommandValidationResult {
  const result = validateCommand(command);

  if (!result.valid) {
    return result;
  }

  // Additional validation for install commands
  const [executable, subcommand] = result.sanitizedCommand!;

  if (!['npm', 'yarn', 'pnpm', 'bun'].includes(executable)) {
    return {
      valid: false,
      error: 'Install commands must use npm, yarn, pnpm, or bun'
    };
  }

  if (subcommand !== 'install' && subcommand !== 'ci') {
    return {
      valid: false,
      error: `Install command must use 'install' or 'ci', not '${subcommand}'`
    };
  }

  return result;
}

/**
 * Validates a build command specifically
 */
export function validateBuildCommand(command: string): CommandValidationResult {
  // Build commands can be empty (optional)
  if (!command || command.trim() === '') {
    return {
      valid: true,
      sanitizedCommand: []
    };
  }

  const result = validateCommand(command);

  if (!result.valid) {
    return result;
  }

  // Additional validation for build commands
  const [executable, subcommand] = result.sanitizedCommand!;

  if (['npm', 'yarn', 'pnpm', 'bun'].includes(executable)) {
    if (subcommand !== 'run' && subcommand !== 'build') {
      return {
        valid: false,
        error: `Build command must use 'run' or 'build', not '${subcommand}'`
      };
    }
  }

  return result;
}

/**
 * Path validation result interface
 */
export interface PathValidationResult {
  valid: boolean;
  sanitizedPath?: string;
  error?: string;
}

/**
 * Validates an app ID to ensure it doesn't contain path traversal characters
 *
 * @param appId - The app ID to validate
 * @returns Validation result
 */
export function validateAppId(appId: string): PathValidationResult {
  if (!appId || typeof appId !== 'string') {
    return {
      valid: false,
      error: 'App ID must be a non-empty string'
    };
  }

  const trimmedId = appId.trim();

  if (!trimmedId) {
    return {
      valid: false,
      error: 'App ID cannot be empty'
    };
  }

  // Check for path traversal attempts
  if (trimmedId.includes('..')) {
    return {
      valid: false,
      error: 'App ID cannot contain ".." (path traversal attempt detected)'
    };
  }

  // Check for path separators
  if (trimmedId.includes('/') || trimmedId.includes('\\')) {
    return {
      valid: false,
      error: 'App ID cannot contain path separators (/ or \\)'
    };
  }

  // Check for absolute path indicators
  if (trimmedId.startsWith('/') || /^[a-zA-Z]:/.test(trimmedId)) {
    return {
      valid: false,
      error: 'App ID cannot be an absolute path'
    };
  }

  // App ID should be UUID or safe identifier
  // Allow alphanumeric, hyphens, and underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
    return {
      valid: false,
      error: 'App ID contains invalid characters. Only alphanumeric, hyphens, and underscores allowed'
    };
  }

  return {
    valid: true,
    sanitizedPath: trimmedId
  };
}

/**
 * Validates a file path to prevent path traversal attacks
 *
 * @param basePath - The base directory that the path should be within
 * @param targetPath - The target path to validate
 * @param pathDescription - Description of what this path is for (for error messages)
 * @returns Validation result with sanitized path
 */
export function validatePath(
  basePath: string,
  targetPath: string,
  pathDescription: string = 'path'
): PathValidationResult {
  if (!targetPath || typeof targetPath !== 'string') {
    return {
      valid: false,
      error: `${pathDescription} must be a non-empty string`
    };
  }

  if (!basePath || typeof basePath !== 'string') {
    return {
      valid: false,
      error: 'Base path must be a non-empty string'
    };
  }

  // Check for null bytes (can be used to bypass filters)
  if (targetPath.includes('\0')) {
    return {
      valid: false,
      error: `${pathDescription} contains null bytes (potential attack detected)`
    };
  }

  // Construct the full path
  const fullPath = path.join(basePath, targetPath);

  // Resolve to absolute path (resolves .. and . and symlinks)
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(basePath);

  // Ensure the resolved path is still within the base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return {
      valid: false,
      error: `${pathDescription} escapes the base directory (path traversal attempt detected)`
    };
  }

  return {
    valid: true,
    sanitizedPath: resolvedPath
  };
}

/**
 * Validates an app directory path
 *
 * @param baseAppsDirectory - The base directory for all apps
 * @param appId - The app ID
 * @returns Validation result with sanitized path
 */
export function validateAppPath(
  baseAppsDirectory: string,
  appId: string
): PathValidationResult {
  // First validate the app ID itself
  const idValidation = validateAppId(appId);
  if (!idValidation.valid) {
    return idValidation;
  }

  // Then validate the constructed path
  return validatePath(baseAppsDirectory, appId, 'app directory');
}
