/**
 * NodeAppManager - Manages Node.js application lifecycle
 * Handles cloning, installing, starting, stopping, and monitoring apps
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import * as Local from '@getflywheel/local';
import { spawn, ChildProcess } from 'child_process';
import treeKill = require('tree-kill');
import { NodeApp, AddAppRequest } from '../types';
import { GitManager, GitProgressEvent } from './GitManager';
import { ConfigManager } from './ConfigManager';
import { PortManager } from './PortManager';
import { NpmManager } from './NpmManager';
import { WordPressEnvManager } from './wordpress/WordPressEnvManager';
import { validateInstallCommand, validateStartCommand, validateBuildCommand } from '../security/validation';

export interface InstallProgress {
  phase: 'detecting' | 'installing' | 'building' | 'complete';
  progress: number;
  message: string;
}

export class NodeAppManager {
  private configManager: ConfigManager;
  private gitManager: GitManager;
  private portManager: PortManager;
  private npmManager: NpmManager;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(configManager: ConfigManager, gitManager: GitManager, portManager: PortManager) {
    this.configManager = configManager;
    this.gitManager = gitManager;
    this.portManager = portManager;
    this.npmManager = new NpmManager();
  }

  /**
   * Add a new Node.js app to a site
   * 1. Clones the repository
   * 2. Runs install command
   * 3. Runs build command (if specified)
   * 4. Saves configuration
   */
  async addApp(
    site: Local.Site,
    appConfig: AddAppRequest['app'],
    onProgress?: (event: GitProgressEvent | InstallProgress) => void
  ): Promise<NodeApp> {
    // Generate app ID
    const appId = uuidv4();

    // Create app directory path
    const appsDir = path.join(site.path, 'node-apps');
    const appPath = path.join(appsDir, appId);

    try {
      // Ensure node-apps directory exists
      await fs.ensureDir(appsDir);

      // Step 1: Clone repository
      if (onProgress) {
        onProgress({
          phase: 'cloning',
          progress: 0,
          message: 'Cloning repository...'
        });
      }

      const cloneResult = await this.gitManager.cloneRepository({
        url: appConfig.gitUrl,
        branch: appConfig.branch || 'main',
        targetPath: appPath,
        subdirectory: appConfig.subdirectory,
        onProgress
      });

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository');
      }

      // Determine working directory (use subdirectory if specified)
      const workingPath = appConfig.subdirectory
        ? path.join(appPath, appConfig.subdirectory)
        : appPath;

      // Step 2: Detect package manager
      const packageManager = await this.detectPackageManager(workingPath);

      // Step 3: Install dependencies
      if (onProgress) {
        onProgress({
          phase: 'installing',
          progress: 30,
          message: `Installing dependencies with ${packageManager}...`
        });
      }

      const installResult = await this.installDependencies(
        workingPath,
        appConfig.installCommand || `${packageManager} install`,
        onProgress
      );

      if (!installResult.success) {
        // Clean up on install failure
        await fs.remove(appPath);
        throw new Error(installResult.error || 'Failed to install dependencies');
      }

      // Step 4: Build if build command specified
      if (appConfig.buildCommand) {
        if (onProgress) {
          onProgress({
            phase: 'building',
            progress: 70,
            message: 'Building application...'
          });
        }

        const buildResult = await this.buildApp(workingPath, appConfig.buildCommand, onProgress);

        if (!buildResult.success) {
          // Clean up on build failure
          await fs.remove(appPath);
          throw new Error(buildResult.error || 'Failed to build application');
        }
      }

      // Step 5: Allocate port
      const port = await this.portManager.allocatePort(site.path, appId);
      console.log(`[NodeAppManager] Allocated port ${port} for app ${appId}`);

      // Step 6: Create app configuration
      const app: NodeApp = {
        id: appId,
        name: appConfig.name,
        gitUrl: appConfig.gitUrl,
        branch: appConfig.branch || 'main',
        subdirectory: appConfig.subdirectory,
        installCommand: appConfig.installCommand || `${packageManager} install`,
        buildCommand: appConfig.buildCommand || '',
        startCommand: appConfig.startCommand || 'npm start',
        nodeVersion: appConfig.nodeVersion || '20.x',
        env: appConfig.env || {},
        status: 'stopped',
        autoStart: appConfig.autoStart ?? false,
        injectWpEnv: appConfig.injectWpEnv ?? true, // Default to true - auto-inject WP env vars
        path: appPath,
        port,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Step 6: Save configuration
      await this.configManager.saveApp(site.id, site.path, app);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'App added successfully'
        });
      }

      return app;
    } catch (error: any) {
      // Clean up on any error
      try {
        await fs.remove(appPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Update an app's configuration
   */
  async updateApp(
    siteId: string,
    sitePath: string,
    appId: string,
    updates: Partial<Omit<NodeApp, 'id' | 'path' | 'createdAt' | 'status' | 'pid'>>
  ): Promise<NodeApp> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    const wasRunning = app.status === 'running';

    // Stop app if running (will be restarted after update if needed)
    if (wasRunning) {
      await this.stopApp(siteId, sitePath, appId);
    }

    // Apply updates
    const updatedApp = {
      ...app,
      ...updates,
      updatedAt: new Date()
    };

    // Save updated configuration
    await this.configManager.saveApp(siteId, sitePath, updatedApp);

    console.log(`[NodeAppManager] Updated app ${appId}`, updates);

    // Restart if it was running
    if (wasRunning) {
      return await this.startApp(siteId, sitePath, appId, undefined);
    }

    return updatedApp;
  }

  /**
   * Remove an app and clean up its files
   */
  async removeApp(siteId: string, sitePath: string, appId: string): Promise<void> {
    // Stop app if running
    if (this.runningProcesses.has(appId)) {
      await this.stopApp(siteId, sitePath, appId);
    }

    // Get app config to find path
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (app && app.path) {
      // Remove app directory
      await fs.remove(app.path);
    }

    // Release port allocation
    await this.portManager.releasePort(sitePath, appId);
    console.log(`[NodeAppManager] Released port for app ${appId}`);

    // Remove from config
    await this.configManager.removeApp(siteId, sitePath, appId);
  }

  /**
   * Remove all apps for a site
   */
  async removeAllAppsForSite(siteId: string, sitePath: string): Promise<void> {
    const apps = await this.configManager.loadApps(siteId, sitePath);

    for (const app of apps) {
      await this.removeApp(siteId, sitePath, app.id);
    }
  }

  /**
   * Start an app
   */
  async startApp(siteId: string, sitePath: string, appId: string, site?: any): Promise<NodeApp> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    if (app.status === 'running') {
      return app; // Already running
    }

    // Validate start command
    const commandValidation = validateStartCommand(app.startCommand);
    if (!commandValidation.valid) {
      throw new Error(`Invalid start command: ${commandValidation.error}`);
    }

    // Update status
    app.status = 'starting';
    await this.configManager.saveApp(siteId, sitePath, app);

    try {
      // Get app directory
      let appDir = app.path || path.join(sitePath, 'node-apps', appId);

      // If subdirectory is specified, use it as the working directory
      if (app.subdirectory) {
        appDir = path.join(appDir, app.subdirectory);
      }

      // Verify directory exists
      if (!await fs.pathExists(appDir)) {
        throw new Error(`App directory not found: ${appDir}`);
      }

      // Use validated and sanitized command
      let [command, ...args] = commandValidation.sanitizedCommand!;
      let useShell = false;

      // Handle package manager commands (npm, yarn, pnpm, npx)
      if (NpmManager.isPackageManagerCommand(command)) {
        const npmInfo = await this.npmManager.getNpmInfo();

        if (npmInfo.type === 'bundled') {
          // Use bundled npm with Local's Node.js
          command = process.execPath;
          args = [npmInfo.path, ...args];
          console.log(`[NodeAppManager] Using bundled npm: ${npmInfo.path}`);
        } else {
          // Use system npm
          useShell = true; // Need shell to find npm in PATH
          console.log(`[NodeAppManager] Using system npm`);
        }
      } else if (command === 'node') {
        // Use Local's bundled Node.js for direct node commands
        command = process.execPath;
        console.log(`[NodeAppManager] Using Local's bundled Node.js: ${command}`);
      }

      // Build environment variables
      let env: Record<string, string> = {
        ...process.env,
        PORT: app.port?.toString() || '3000',
        NODE_ENV: 'development',
        // Enable Node.js mode in Electron (required for process.execPath)
        ELECTRON_RUN_AS_NODE: '1'
      };

      // Inject WordPress environment variables if enabled
      if (app.injectWpEnv) {
        try {
          const wpEnv = WordPressEnvManager.extractWordPressEnv(site);

          // Log successful extraction (sanitized)
          const sanitizedWpEnv = WordPressEnvManager.sanitizeForLogging(wpEnv);
          console.log(`[NodeAppManager] Injecting WordPress environment variables for ${app.name}:`, sanitizedWpEnv);

          // Merge WordPress env vars with app env
          env = {
            ...env,
            ...wpEnv,
            ...app.env // App-specific env vars take precedence
          };
        } catch (error: any) {
          // Log warning but continue - app can still run without WP env vars
          console.warn(`[NodeAppManager] Failed to extract WordPress environment for ${app.name}:`, error.message);
          console.warn(`[NodeAppManager] App will start without WordPress environment variables`);

          // Still merge app-specific env vars
          env = {
            ...env,
            ...app.env
          };
        }
      } else {
        // WordPress env injection disabled - just use app env
        env = {
          ...env,
          ...app.env
        };
      }

      // Create logs directory in site's logs folder (proper location)
      // Ensure sitePath is absolute (expand ~ if present)
      const absoluteSitePath = sitePath.startsWith('~')
        ? path.join(process.env.HOME || '', sitePath.slice(1))
        : sitePath;

      const logsDir = path.join(absoluteSitePath, 'logs', 'node-apps');
      await fs.ensureDir(logsDir);
      const logFile = path.join(logsDir, `${appId}.log`);

      // Log the path for debugging
      console.log(`[NodeAppManager] Creating log file: ${logFile}`);

      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      // Log spawn details
      logStream.write(`\n=== Starting app at ${new Date().toISOString()} ===\n`);
      logStream.write(`Working directory: ${appDir}\n`);
      logStream.write(`Node.js: ${command === process.execPath ? `Local bundled (${command})` : command}\n`);
      logStream.write(`Command: ${command} ${args.join(' ')}\n`);
      logStream.write(`PORT: ${env.PORT}\n`);
      logStream.write(`========================================\n\n`);

      // Spawn process with security: shell: false prevents command injection
      // Exception: use shell for system npm commands to find them in PATH
      const child = spawn(command, args, {
        cwd: appDir,
        env,
        shell: useShell, // Only true for system package managers
        detached: false
      });

      // Immediately log if spawn succeeded
      if (child.pid) {
        logStream.write(`Process spawned with PID: ${child.pid}\n`);
      } else {
        logStream.write(`WARNING: Process spawned but no PID assigned\n`);
      }

      // Store process reference
      this.runningProcesses.set(appId, child);

      // Handle stdout
      child.stdout?.on('data', (data) => {
        logStream.write(`[stdout] ${data.toString()}`);
      });

      // Handle stderr
      child.stderr?.on('data', (data) => {
        logStream.write(`[stderr] ${data.toString()}`);
      });

      // Handle process exit
      child.on('exit', async (code, signal) => {
        const exitMessage = `\n=== Process exited at ${new Date().toISOString()} ===\nExit code: ${code}\nSignal: ${signal}\n`;
        logStream.write(exitMessage);

        // Log to console for debugging
        console.log(`[NodeAppManager] App ${app.name} (${appId}) exited with code ${code}, signal: ${signal}`);

        logStream.end();

        this.runningProcesses.delete(appId);
        const updatedApp = await this.configManager.getApp(siteId, sitePath, appId);
        if (updatedApp) {
          // Only update status if we're not in the middle of a managed stop (stopApp handles that)
          // If status is 'stopping', stopApp() will handle the final 'stopped' status
          if (updatedApp.status !== 'stopping') {
            updatedApp.status = 'stopped';
            updatedApp.pid = undefined;
            updatedApp.lastError = code !== 0 ? `Process exited with code ${code}` : undefined;
            await this.configManager.saveApp(siteId, sitePath, updatedApp);
            console.log(`[NodeAppManager] Exit handler updated status to stopped for ${app.name}`);
          } else {
            console.log(`[NodeAppManager] Exit handler skipping status update (app is being stopped by stopApp)`);
          }
        }
      });

      // Handle process error
      child.on('error', async (error) => {
        const errorMessage = `\n=== Process ERROR at ${new Date().toISOString()} ===\nError: ${error.message}\nStack: ${error.stack}\n`;
        logStream.write(errorMessage);

        // Log to console for debugging
        console.error(`[NodeAppManager] App ${app.name} (${appId}) error:`, error);

        logStream.end();

        const updatedApp = await this.configManager.getApp(siteId, sitePath, appId);
        if (updatedApp) {
          updatedApp.status = 'error';
          updatedApp.lastError = error.message;
          await this.configManager.saveApp(siteId, sitePath, updatedApp);
        }
      });

      // Update app status to running
      app.status = 'running';
      app.pid = child.pid;
      app.startedAt = new Date();
      await this.configManager.saveApp(siteId, sitePath, app);

      return app;
    } catch (error: any) {
      app.status = 'error';
      app.lastError = error.message;
      await this.configManager.saveApp(siteId, sitePath, app);
      throw error;
    }
  }

  /**
   * Stop an app
   */
  async stopApp(siteId: string, sitePath: string, appId: string): Promise<NodeApp> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    if (app.status === 'stopped') {
      return app; // Already stopped
    }

    // Update status
    app.status = 'stopping';
    await this.configManager.saveApp(siteId, sitePath, app);

    // Stop the process if we're managing it
    const child = this.runningProcesses.get(appId);
    if (child && child.pid) {
      return new Promise((resolve, reject) => {
        // Kill entire process tree to ensure cleanup of child processes
        treeKill(child.pid!, 'SIGTERM', (error: any) => {
          if (error) {
            console.log(`[NodeAppManager] SIGTERM failed, trying SIGKILL for ${appId}`);
            // Try force kill if graceful termination fails
            treeKill(child.pid!, 'SIGKILL', (_killError: any) => {
              this.runningProcesses.delete(appId);
              // Get fresh app data to avoid stale state
              this.configManager.getApp(siteId, sitePath, appId)
                .then((freshApp) => {
                  if (freshApp) {
                    freshApp.status = 'stopped';
                    freshApp.pid = undefined;
                    return this.configManager.saveApp(siteId, sitePath, freshApp);
                  }
                  return Promise.resolve();
                })
                .then(() => {
                  console.log(`[NodeAppManager] App ${appId} stopped (SIGKILL)`);
                  // Return the original app object with updated status
                  app.status = 'stopped';
                  app.pid = undefined;
                  resolve(app);
                })
                .catch((saveError) => {
                  console.error(`[NodeAppManager] Error saving stopped app:`, saveError);
                  reject(saveError);
                });
            });
          } else {
            console.log(`[NodeAppManager] App ${appId} stopped successfully (SIGTERM)`);
            this.runningProcesses.delete(appId);
            // Get fresh app data to avoid stale state
            this.configManager.getApp(siteId, sitePath, appId)
              .then((freshApp) => {
                if (freshApp) {
                  freshApp.status = 'stopped';
                  freshApp.pid = undefined;
                  return this.configManager.saveApp(siteId, sitePath, freshApp);
                }
                return Promise.resolve();
              })
              .then(() => {
                // Return the original app object with updated status
                app.status = 'stopped';
                app.pid = undefined;
                resolve(app);
              })
              .catch((saveError) => {
                console.error(`[NodeAppManager] Error saving stopped app:`, saveError);
                reject(saveError);
              });
          }
        });
      });
    } else {
      console.log(`[NodeAppManager] No running process for ${appId}, just updating status`);
      // No running process, just update status
      app.status = 'stopped';
      app.pid = undefined;
      await this.configManager.saveApp(siteId, sitePath, app);
      return app;
    }
  }

  /**
   * Restart an app
   */
  async restartApp(siteId: string, sitePath: string, appId: string, site?: any): Promise<NodeApp> {
    await this.stopApp(siteId, sitePath, appId);
    return await this.startApp(siteId, sitePath, appId, site);
  }

  /**
   * Get all apps for a site
   */
  async getAppsForSite(siteId: string, sitePath: string): Promise<NodeApp[]> {
    return await this.configManager.loadApps(siteId, sitePath);
  }

  /**
   * Get synchronous version for sites (used in hooks)
   */
  getAppsForSiteSync(_siteId: string): NodeApp[] {
    // This is a simplified sync version for hooks
    // In production, this should use a cache
    return [];
  }

  /**
   * Get single app
   */
  async getApp(siteId: string, sitePath: string, appId: string): Promise<NodeApp | null> {
    return await this.configManager.getApp(siteId, sitePath, appId);
  }

  /**
   * Update app environment variables
   */
  async updateAppEnv(
    siteId: string,
    sitePath: string,
    appId: string,
    env: Record<string, string>
  ): Promise<void> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    app.env = env;
    app.updatedAt = new Date();

    await this.configManager.saveApp(siteId, sitePath, app);
  }

  /**
   * Get app logs
   */
  async getAppLogs(siteId: string, sitePath: string, appId: string, lines: number = 100): Promise<string[]> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    // Read from log file
    const logFile = path.join(sitePath, 'logs', 'node-apps', `${appId}.log`);

    if (!await fs.pathExists(logFile)) {
      return [];
    }

    const content = await fs.readFile(logFile, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());

    // Return last N lines
    return allLines.slice(-lines);
  }

  /**
   * Detect package manager from lockfiles
   */
  private async detectPackageManager(appPath: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
    // Check for lockfiles in order of preference
    if (await fs.pathExists(path.join(appPath, 'bun.lockb'))) {
      return 'bun';
    }

    if (await fs.pathExists(path.join(appPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }

    if (await fs.pathExists(path.join(appPath, 'yarn.lock'))) {
      return 'yarn';
    }

    // Default to npm
    return 'npm';
  }

  /**
   * Install dependencies
   */
  private async installDependencies(
    appPath: string,
    installCommand: string,
    onProgress?: (event: InstallProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    // Validate install command
    const validation = validateInstallCommand(installCommand);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      const [command, ...args] = validation.sanitizedCommand!;

      // Use NpmManager for package manager commands
      if (NpmManager.isPackageManagerCommand(command)) {
        await this.npmManager.runCommand(args, {
          cwd: appPath,
          onProgress: (output) => {
            if (onProgress) {
              onProgress({
                phase: 'installing',
                progress: 50, // Rough estimate
                message: output
              });
            }
          }
        });
      } else {
        // Run other commands directly
        await this.runCommand(command, args, appPath, (output) => {
          if (onProgress) {
            onProgress({
              phase: 'installing',
              progress: 50,
              message: output
            });
          }
        });
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Installation failed'
      };
    }
  }

  /**
   * Build application
   */
  private async buildApp(
    appPath: string,
    buildCommand: string,
    onProgress?: (event: InstallProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    // Validate build command
    const validation = validateBuildCommand(buildCommand);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    if (!validation.sanitizedCommand || validation.sanitizedCommand.length === 0) {
      // Empty build command is valid (skip build)
      return { success: true };
    }

    try {
      const [command, ...args] = validation.sanitizedCommand;

      // Use NpmManager for package manager commands
      if (NpmManager.isPackageManagerCommand(command)) {
        await this.npmManager.runCommand(args, {
          cwd: appPath,
          onProgress: (output) => {
            if (onProgress) {
              onProgress({
                phase: 'building',
                progress: 85, // Rough estimate
                message: output
              });
            }
          }
        });
      } else {
        // Run other commands directly
        await this.runCommand(command, args, appPath, (output) => {
          if (onProgress) {
            onProgress({
              phase: 'building',
              progress: 85,
              message: output
            });
          }
        });
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Build failed'
      };
    }
  }

  /**
   * Run a command and return a promise
   */
  private runCommand(
    command: string,
    args: string[],
    cwd: string,
    onOutput?: (output: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        env: { ...process.env }
      });

      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        if (onOutput) onOutput(output);
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        if (onOutput) onOutput(output);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}
