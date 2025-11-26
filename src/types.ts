import type * as Local from '@getflywheel/local';

// ========================================
// Local Service Container Type Definitions
// ========================================
// These types describe the interfaces for Local's service container services
// that we depend on but are not fully typed in the @getflywheel/local package.

/**
 * Local's logger service interface
 */
export interface LocalLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  log(level: string, message: string, context?: Record<string, unknown>): void;
}

/**
 * Local's site data service interface
 */
export interface LocalSiteData {
  getSite(siteId: string): Local.Site | undefined;
  getSites(): Local.Site[];
}

/**
 * Site status type
 */
export type SiteStatus = 'running' | 'stopped' | 'starting' | 'stopping';

/**
 * Local's site process manager service interface
 */
export interface LocalSiteProcessManager {
  getSiteStatus(site: Local.Site): SiteStatus;
  start(site: Local.Site): Promise<void>;
  stop(site: Local.Site, options?: { dumpDatabase?: boolean }): Promise<void>;
}

/**
 * Local's site database service interface
 */
export interface LocalSiteDatabase {
  waitForDB(site: Local.Site): Promise<boolean>;
}

/**
 * Local's ports service interface
 */
export interface LocalPorts {
  getAvailablePort(): Promise<number>;
}

/**
 * WP-CLI execution result
 */
export interface WpCliRunResult {
  stdout: string;
  stderr: string;
}

/**
 * Local's WP-CLI service interface
 */
export interface LocalWpCli {
  run(site: Local.Site, args: string[]): Promise<WpCliRunResult>;
}

/**
 * Aggregate interface for all Local services we depend on
 */
export interface LocalServices {
  localLogger: LocalLogger;
  siteData: LocalSiteData;
  siteProcessManager: LocalSiteProcessManager;
  siteDatabase: LocalSiteDatabase;
  ports: LocalPorts;
  wpCli: LocalWpCli;
}

// ========================================
// Result Type Pattern
// ========================================
// Standardized return types for operations that can succeed or fail.
// Provides explicit success/error handling without exceptions.

/**
 * Success result
 */
export interface SuccessResult<T> {
  success: true;
  data: T;
}

/**
 * Error result
 */
export interface ErrorResult<E = string> {
  success: false;
  error: E;
}

/**
 * Result type - discriminated union for explicit error handling
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) return { success: false, error: 'Division by zero' };
 *   return { success: true, data: a / b };
 * }
 *
 * const result = divide(10, 2);
 * if (result.success) {
 *   console.log(result.data); // 5
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T, E = string> = SuccessResult<T> | ErrorResult<E>;

/**
 * Async result type alias
 */
export type AsyncResult<T, E = string> = Promise<Result<T, E>>;

/**
 * Helper to create a success result
 */
export function ok<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function err<E = string>(error: E): ErrorResult<E> {
  return { success: false, error };
}

// Re-export config types from schema
export type {
  PluginConfig,
  BundledPluginConfig,
  GitPluginConfig,
  ZipPluginConfig,
  WpOrgPluginConfig,
  NodeConfig,
  WordPressConfig,
  NodeOrchestratorConfig,
} from './lib/schemas/nodeOrchestratorConfig';

/**
 * Plugin config input type - allows optional autoActivate
 * This is more flexible than the strict PluginConfig for function parameters
 */
export type PluginConfigInput = {
  slug: string;
  autoActivate?: boolean;
  name?: string;
} & (
  | { source: 'bundled'; path: string }
  | { source: 'git'; url: string; branch?: string }
  | { source: 'zip'; url: string; checksum?: string }
  | { source: 'wporg'; version?: string }
);

export interface NodeApp {
  id: string;
  name: string;
  gitUrl: string;
  branch: string;
  path?: string;                // Where it's cloned (alias for localPath)
  localPath?: string;           // Where it's cloned (deprecated, use path)
  installCommand: string;       // npm install, yarn, pnpm install
  buildCommand?: string;        // npm run build
  startCommand: string;         // npm start, node index.js
  port?: number;                // Allocated port
  nodeVersion: string;          // 18.x, 20.x, etc.
  env: Record<string, string>;
  status: NodeAppStatus;
  autoStart: boolean;
  injectWpEnv: boolean;         // Auto-inject WordPress environment variables
  lastError?: string;
  pid?: number;
  startedAt?: Date;
  createdAt?: Date;             // When the app was added
  updatedAt?: Date;             // When the app was last updated
  bundledPlugins?: string[];    // IDs of WordPress plugins bundled with this app
  healthCheck?: HealthCheckConfig;
  logs?: string[];
}

export type NodeAppStatus = 
  | 'stopped'
  | 'cloning'
  | 'installing'
  | 'building'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'
  | 'restarting';

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;     // /health
  interval: number;     // milliseconds
  timeout: number;      // milliseconds
  retries: number;
}

export interface SiteNodeApps {
  siteId: string;
  apps: NodeApp[];
}

export interface NodeAppConfig {
  defaultNodeVersion: string;
  defaultInstallCommand: string;
  defaultStartCommand: string;
  defaultBranch: string;
  healthCheckInterval: number;
  maxRestarts: number;
  restartDelay: number;
  logMaxLines: number;
  nodeBinPaths: Record<string, string>; // version -> path
}

export interface GitConfig {
  url: string;
  branch: string;
  auth?: {
    type: 'ssh' | 'https' | 'token';
    token?: string;
    sshKey?: string;
  };
}

export interface ProcessInfo {
  pid: number;
  status: 'running' | 'stopped';
  cpu: number;
  memory: number;
  uptime: number;
}

// IPC Message Types
export interface AddAppRequest {
  siteId: string;
  app: Partial<NodeApp> & {
    gitUrl: string;
    name: string;
  };
}

export interface AddAppResponse {
  success: boolean;
  app?: NodeApp;
  error?: string;
}

export interface RemoveAppRequest {
  siteId: string;
  appId: string;
}

export interface StartAppRequest {
  siteId: string;
  appId: string;
}

export interface StopAppRequest {
  siteId: string;
  appId: string;
}

export interface GetAppsRequest {
  siteId: string;
}

export interface GetAppsResponse {
  success: boolean;
  apps?: NodeApp[];
  error?: string;
}

export interface GetLogsRequest {
  siteId: string;
  appId: string;
  lines?: number;
}

export interface GetLogsResponse {
  success: boolean;
  logs?: string[];
  error?: string;
}

export interface UpdateEnvRequest {
  siteId: string;
  appId: string;
  env: Record<string, string>;
}

export interface UpdateEnvResponse {
  success: boolean;
  error?: string;
}

// Events
export interface NodeAppEvent {
  siteId: string;
  appId: string;
  app: NodeApp;
  timestamp: Date;
}

export interface NodeAppLogEvent {
  siteId: string;
  appId: string;
  type: 'stdout' | 'stderr';
  data: string;
  timestamp: Date;
}

// WordPress Integration
export interface WordPressEnv {
  WP_DB_HOST: string;
  WP_DB_NAME: string;
  WP_DB_USER: string;
  WP_DB_PASSWORD: string;
  WP_SITE_URL: string;
  WP_HOME_URL: string;
  WP_ADMIN_URL: string;
  WP_CONTENT_DIR: string;
  WP_UPLOADS_DIR: string;
  DATABASE_URL?: string;
}

// WordPress Plugin Types
export type PluginSource = 'git' | 'bundled' | 'zip' | 'wporg';

export interface WordPressPlugin {
  id: string;
  name: string;
  slug: string;           // Directory name in wp-content/plugins
  source: PluginSource;   // Installation source
  status: 'installing' | 'installed' | 'active' | 'inactive' | 'error';
  installedPath: string;
  version?: string;
  error?: string;
  autoActivate?: boolean; // Whether to auto-activate on site start
  createdAt: Date;
  updatedAt?: Date;

  // Source-specific fields (optional based on source type)
  gitUrl?: string;        // For git and bundled sources
  branch?: string;        // For git source
  zipUrl?: string;        // For zip source
  bundledPath?: string;   // For bundled source (path within node app repo)
}

export interface SiteWordPressPlugins {
  siteId: string;
  plugins: WordPressPlugin[];
}

// WordPress Plugin IPC Types
export interface InstallPluginRequest {
  siteId: string;
  plugin: {
    name: string;
    gitUrl: string;
    branch: string;
    slug: string;
    autoActivate?: boolean;
  };
}

export interface InstallPluginResponse {
  success: boolean;
  plugin?: WordPressPlugin;
  error?: string;
}

export interface ActivatePluginRequest {
  siteId: string;
  pluginId: string;
}

export interface DeactivatePluginRequest {
  siteId: string;
  pluginId: string;
}

export interface RemovePluginRequest {
  siteId: string;
  pluginId: string;
}

export interface GetPluginsRequest {
  siteId: string;
}

export interface GetPluginsResponse {
  success: boolean;
  plugins?: WordPressPlugin[];
  error?: string;
}
