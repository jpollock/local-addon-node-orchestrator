/**
 * Centralized constants for the Node Orchestrator addon
 * All magic numbers and configurable values should be defined here
 */

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Time to wait for process to start before considering it failed */
  PROCESS_START: 3_000,
  /** Graceful termination timeout (SIGTERM) */
  PROCESS_KILL: 5_000,
  /** Forceful termination timeout (SIGKILL) */
  PROCESS_FORCE_KILL: 3_000,
  /** npm detection timeout */
  NPM_DETECTION: 3_000,
  /** Database ready wait timeout */
  DATABASE_READY: 30_000,
  /** npm install timeout */
  NPM_INSTALL: 600_000,
  /** Build command timeout */
  BUILD_COMMAND: 300_000,
} as const;

/**
 * Size and count limits
 */
export const LIMITS = {
  /** Maximum number of apps per site */
  MAX_APPS_PER_SITE: 10,
  /** Maximum number of HTTP redirects to follow */
  MAX_REDIRECTS: 5,
  /** Maximum number of log lines to return */
  MAX_LOG_LINES: 100,
  /** Cache time-to-live in milliseconds */
  CACHE_TTL_MS: 60000,
  /** Maximum cache entries */
  MAX_CACHE_SIZE: 100,
} as const;

/**
 * Default values for app configuration
 */
export const DEFAULTS = {
  /** Default Node.js version */
  NODE_VERSION: '20.x',
  /** Default git branch */
  GIT_BRANCH: 'main',
  /** Default start command */
  START_COMMAND: 'npm start',
  /** Default port if allocation fails */
  PORT: 3000,
} as const;

/**
 * Environment variable names injected into Node apps
 */
export const ENV_VARS = {
  /** Port number */
  PORT: 'PORT',
  /** Node environment */
  NODE_ENV: 'NODE_ENV',
  /** Electron Node.js mode flag */
  ELECTRON_RUN_AS_NODE: 'ELECTRON_RUN_AS_NODE',
} as const;

/**
 * WordPress environment variable names
 */
export const WP_ENV_VARS = {
  DB_HOST: 'WP_DB_HOST',
  DB_NAME: 'WP_DB_NAME',
  DB_USER: 'WP_DB_USER',
  DB_PASSWORD: 'WP_DB_PASSWORD',
  SITE_URL: 'WP_SITE_URL',
  HOME_URL: 'WP_HOME_URL',
  ADMIN_URL: 'WP_ADMIN_URL',
  CONTENT_DIR: 'WP_CONTENT_DIR',
  UPLOADS_DIR: 'WP_UPLOADS_DIR',
  DATABASE_URL: 'DATABASE_URL',
} as const;

/**
 * Allowed parent environment variables to inherit
 * Used for security to limit what env vars are passed to child processes
 */
export const ALLOWED_PARENT_ENV = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'TERM',
  'TMPDIR',
] as const;

/**
 * File paths and patterns
 */
export const PATHS = {
  /** Node apps directory name within site */
  NODE_APPS_DIR: 'node-apps',
  /** Configuration directory within site */
  CONFIG_DIR: 'conf/node-apps',
  /** Apps configuration filename */
  APPS_CONFIG: 'apps.json',
  /** Plugins configuration filename */
  PLUGINS_CONFIG: 'plugins.json',
  /** Logs directory within site */
  LOGS_DIR: 'logs/node-apps',
} as const;

/**
 * Package manager lockfile mapping
 */
export const PACKAGE_MANAGER_LOCKFILES = {
  'bun.lockb': 'bun',
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'package-lock.json': 'npm',
} as const;
