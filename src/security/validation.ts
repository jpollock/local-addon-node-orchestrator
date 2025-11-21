/**
 * Security validation module for Node.js Orchestrator addon
 * Prevents command injection and validates user input
 */

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
