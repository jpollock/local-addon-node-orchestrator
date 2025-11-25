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
