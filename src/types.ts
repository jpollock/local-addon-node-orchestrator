import * as Local from '@getflywheel/local';

export interface NodeApp {
  id: string;
  name: string;
  gitUrl: string;
  branch: string;
  localPath?: string;           // Where it's cloned
  installCommand: string;       // npm install, yarn, pnpm install
  buildCommand?: string;        // npm run build
  startCommand: string;         // npm start, node index.js
  port?: number;                // Allocated port
  nodeVersion: string;          // 18.x, 20.x, etc.
  env: Record<string, string>;
  status: NodeAppStatus;
  autoStart: boolean;
  lastError?: string;
  pid?: number;
  startedAt?: Date;
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
