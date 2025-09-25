import * as LocalMain from '@getflywheel/local/main';
import * as Local from '@getflywheel/local';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ChildProcess, spawn } from 'child_process';
import * as treeKill from 'tree-kill';
import { NodeApp, NodeAppStatus } from '../types';

export default class NodeOrchestratorService extends LocalMain.LightningService {
  readonly serviceName = 'node-orchestrator';
  readonly binVersion = '1.0.0';

  private processes: Map<string, ChildProcess> = new Map();
  private apps: NodeApp[] = [];
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  get requiredPorts() {
    // We'll dynamically allocate ports per app
    return {};
  }

  get bins() {
    // We'll use the system Node.js or Local's bundled Node.js
    const nodePath = process.execPath; // Use Electron's Node.js

    return {
      darwin: {
        [this.binVersion]: nodePath
      },
      win32: {
        [this.binVersion]: nodePath
      },
      linux: {
        [this.binVersion]: nodePath
      }
    };
  }

  async preprovision(): Promise<void> {
    const { localLogger } = LocalMain.getServiceContainer().cradle;
    localLogger.log('info', `Provisioning Node.js Orchestrator for ${this._site.name}`);

    // Create directories for Node.js apps
    const dirs = [
      this.getAppsDirectory(),
      this.getLogsDirectory(),
      this.getConfigDirectory()
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }

    // Load saved apps configuration
    await this.loadAppsConfig();
  }

  start(): LocalMain.IProcessOpts[] {
    // We don't start a process for the orchestrator itself
    // Individual Node.js apps are managed separately
    return [];
  }

  async stop(): Promise<void> {
    const { localLogger } = LocalMain.getServiceContainer().cradle;
    localLogger.log('info', `Stopping Node.js Orchestrator for ${this._site.name}`);

    // Stop all running apps
    for (const app of this.apps) {
      if (app.status === 'running' && app.id) {
        await this.stopNodeApp(app.id);
      }
    }

    // Clear health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Save apps configuration
    await this.saveAppsConfig();
  }

  // Public methods for app management
  async startNodeApp(app: NodeApp): Promise<void> {
    const { localLogger } = LocalMain.getServiceContainer().cradle;
    
    try {
      // Update app status
      app.status = 'starting';
      await this.updateApp(app);

      // Get app directory
      const appDir = path.join(this.getAppsDirectory(), app.id);
      const logFile = path.join(this.getLogsDirectory(), `${app.id}.log`);

      // Check if directory exists
      if (!await fs.pathExists(appDir)) {
        throw new Error(`App directory not found: ${appDir}`);
      }

      // Parse start command
      const [command, ...args] = app.startCommand.split(' ');

      // Build environment variables
      const env = {
        ...process.env,
        ...app.env,
        PORT: app.port?.toString() || '3000',
        NODE_ENV: 'development',
        LOCAL_SITE_ID: this._site.id,
        LOCAL_SITE_NAME: this._site.name,
        LOCAL_SITE_DOMAIN: this._site.domain,
        LOCAL_SITE_URL: this._site.url
      };

      // Create log stream
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      // Spawn process
      const child = spawn(command, args, {
        cwd: appDir,
        env,
        shell: true,
        detached: false
      });

      // Store process reference
      this.processes.set(app.id, child);

      // Handle stdout
      child.stdout?.on('data', (data) => {
        const message = data.toString();
        logStream.write(`[stdout] ${message}`);
        
        // Store recent logs in memory
        if (!app.logs) app.logs = [];
        app.logs.push(message);
        if (app.logs.length > 100) {
          app.logs.shift();
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data) => {
        const message = data.toString();
        logStream.write(`[stderr] ${message}`);
        
        if (!app.logs) app.logs = [];
        app.logs.push(`[ERROR] ${message}`);
        if (app.logs.length > 100) {
          app.logs.shift();
        }
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        logStream.write(`Process exited with code ${code} and signal ${signal}\n`);
        logStream.end();
        
        this.processes.delete(app.id);
        app.status = 'stopped';
        app.pid = undefined;
        this.updateApp(app);

        localLogger.log('info', `Node.js app ${app.name} stopped`, { code, signal });
      });

      // Handle process error
      child.on('error', (error) => {
        logStream.write(`Process error: ${error.message}\n`);
        logStream.end();
        
        app.status = 'error';
        app.lastError = error.message;
        this.updateApp(app);

        localLogger.error(`Node.js app ${app.name} error`, { error });
      });

      // Update app status
      app.status = 'running';
      app.pid = child.pid;
      app.startedAt = new Date();
      await this.updateApp(app);

      // Start health check if configured
      if (app.healthCheck?.enabled) {
        this.startHealthCheck(app);
      }

      localLogger.log('info', `Started Node.js app ${app.name} on port ${app.port}`);
    } catch (error) {
      app.status = 'error';
      app.lastError = error.message;
      await this.updateApp(app);
      throw error;
    }
  }

  async stopNodeApp(appId: string): Promise<void> {
    const { localLogger } = LocalMain.getServiceContainer().cradle;
    
    const app = this.apps.find(a => a.id === appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    const child = this.processes.get(appId);
    if (!child) {
      app.status = 'stopped';
      await this.updateApp(app);
      return;
    }

    // Update status
    app.status = 'stopping';
    await this.updateApp(app);

    // Stop health check
    const healthInterval = this.healthCheckIntervals.get(appId);
    if (healthInterval) {
      clearInterval(healthInterval);
      this.healthCheckIntervals.delete(appId);
    }

    return new Promise((resolve, reject) => {
      // Kill process tree
      if (child.pid) {
        treeKill(child.pid, 'SIGTERM', (error) => {
          if (error) {
            localLogger.error(`Failed to stop app ${app.name}`, { error });
            // Try force kill
            treeKill(child.pid!, 'SIGKILL', () => {
              this.processes.delete(appId);
              app.status = 'stopped';
              app.pid = undefined;
              this.updateApp(app).then(resolve).catch(reject);
            });
          } else {
            this.processes.delete(appId);
            app.status = 'stopped';
            app.pid = undefined;
            this.updateApp(app).then(resolve).catch(reject);
          }
        });
      } else {
        this.processes.delete(appId);
        app.status = 'stopped';
        app.pid = undefined;
        this.updateApp(app).then(resolve).catch(reject);
      }
    });
  }

  async restartNodeApp(appId: string): Promise<void> {
    await this.stopNodeApp(appId);
    const app = this.apps.find(a => a.id === appId);
    if (app) {
      await this.startNodeApp(app);
    }
  }

  // Helper methods
  private getAppsDirectory(): string {
    return path.join(this._site.path, 'node-apps');
  }

  private getLogsDirectory(): string {
    return path.join(this._site.path, 'logs', 'node-apps');
  }

  private getConfigDirectory(): string {
    return path.join(this._site.path, 'conf', 'node-apps');
  }

  private getConfigPath(): string {
    return path.join(this.getConfigDirectory(), 'apps.json');
  }

  private async loadAppsConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    if (await fs.pathExists(configPath)) {
      this.apps = await fs.readJson(configPath);
    }
  }

  private async saveAppsConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    await fs.writeJson(configPath, this.apps, { spaces: 2 });
  }

  private async updateApp(app: NodeApp): Promise<void> {
    const index = this.apps.findIndex(a => a.id === app.id);
    if (index >= 0) {
      this.apps[index] = app;
    } else {
      this.apps.push(app);
    }
    await this.saveAppsConfig();
  }

  private startHealthCheck(app: NodeApp): void {
    if (!app.healthCheck || !app.port) return;

    const { localLogger } = LocalMain.getServiceContainer().cradle;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `http://localhost:${app.port}${app.healthCheck!.endpoint}`,
          { 
            signal: AbortSignal.timeout(app.healthCheck!.timeout)
          }
        );

        if (!response.ok) {
          localLogger.warn(`Health check failed for ${app.name}`, {
            status: response.status
          });
          // Could trigger restart here if needed
        }
      } catch (error) {
        localLogger.warn(`Health check error for ${app.name}`, { error });
      }
    }, app.healthCheck.interval);

    this.healthCheckIntervals.set(app.id, interval);
  }

  // Public API for other parts of the addon
  getApps(): NodeApp[] {
    return this.apps;
  }

  getApp(appId: string): NodeApp | undefined {
    return this.apps.find(a => a.id === appId);
  }

  addApp(app: NodeApp): void {
    this.apps.push(app);
    this.saveAppsConfig();
  }

  removeApp(appId: string): void {
    this.apps = this.apps.filter(a => a.id !== appId);
    this.saveAppsConfig();
  }
}
