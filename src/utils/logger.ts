/**
 * Centralized Logger Utility
 *
 * Provides structured logging for the Node Orchestrator addon.
 * Uses Local's localLogger when available, falls back to console in development.
 */

interface LogContext {
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  log(level: LogLevel, message: string, context?: LogContext): void;
}

// Module prefix for all log messages
const PREFIX = '[Node Orchestrator]';

// Reference to Local's logger, set via initialize()
let localLogger: Logger | null = null;

/**
 * Initialize the logger with Local's localLogger instance
 * @param logger - The localLogger from Local's service container
 */
export function initializeLogger(logger: Logger): void {
  localLogger = logger;
}

/**
 * Get the current logger instance
 */
export function getLogger(): Logger {
  if (localLogger) {
    return localLogger;
  }

  // Fallback logger for development/testing
  return {
    debug(message: string, context?: LogContext) {
      if (process.env.NODE_ENV !== 'test') {
        console.debug(`${PREFIX} ${message}`, context || '');
      }
    },
    info(message: string, context?: LogContext) {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`${PREFIX} ${message}`, context || '');
      }
    },
    warn(message: string, context?: LogContext) {
      console.warn(`${PREFIX} ${message}`, context || '');
    },
    error(message: string, context?: LogContext) {
      console.error(`${PREFIX} ${message}`, context || '');
    },
    log(level: LogLevel, message: string, context?: LogContext) {
      switch (level) {
        case 'debug':
          this.debug(message, context);
          break;
        case 'info':
          this.info(message, context);
          break;
        case 'warn':
          this.warn(message, context);
          break;
        case 'error':
          this.error(message, context);
          break;
      }
    },
  };
}

/**
 * Create a child logger with a specific component name
 * @param component - The component name to prefix logs with
 */
export function createLogger(component: string): Logger {
  const componentPrefix = `[${component}]`;

  return {
    debug(message: string, context?: LogContext) {
      getLogger().log('debug', `${componentPrefix} ${message}`, context);
    },
    info(message: string, context?: LogContext) {
      getLogger().log('info', `${componentPrefix} ${message}`, context);
    },
    warn(message: string, context?: LogContext) {
      getLogger().warn(`${componentPrefix} ${message}`, context);
    },
    error(message: string, context?: LogContext) {
      getLogger().error(`${componentPrefix} ${message}`, context);
    },
    log(level: LogLevel, message: string, context?: LogContext) {
      getLogger().log(level, `${componentPrefix} ${message}`, context);
    },
  };
}

// Pre-configured loggers for common components
export const logger = {
  main: createLogger('Main'),
  nodeApp: createLogger('NodeAppManager'),
  npm: createLogger('NpmManager'),
  wpCli: createLogger('WpCliManager'),
  wpPlugin: createLogger('WordPressPluginManager'),
  config: createLogger('ConfigManager'),
  renderer: createLogger('Renderer'),
};

export default getLogger;
