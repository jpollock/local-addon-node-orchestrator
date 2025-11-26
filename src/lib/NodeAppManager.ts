/**
 * NodeAppManager - Manages Node.js application lifecycle
 * Handles cloning, installing, starting, stopping, and monitoring apps
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as Local from '@getflywheel/local';
import { spawn, ChildProcess } from 'child_process';
import treeKill = require('tree-kill');
import { NodeApp, AddAppRequest } from '../types';
import { GitManager, GitProgressEvent } from './GitManager';
import { ConfigManager } from './ConfigManager';
import { NpmManager } from './NpmManager';
import { WordPressEnvManager } from './wordpress/WordPressEnvManager';
import { WordPressPluginManager } from './wordpress/WordPressPluginManager';
import { BundledPluginDetector } from './wordpress/BundledPluginDetector';
import { validateInstallCommand, validateStartCommand, validateBuildCommand } from '../security/validation';
import { logger } from '../utils/logger';
import { withTimeout, TIMEOUTS } from '../utils/timeout';
import { getSafeEnv } from '../utils/safeEnv';
import { getErrorMessage } from '../utils/errorUtils';

export interface InstallProgress {
  phase: 'detecting' | 'installing' | 'building' | 'installing-plugins' | 'complete';
  progress: number;
  message: string;
}

/**
 * Tracks a running process with its associated log stream
 * Ensures proper cleanup of both resources
 */
interface ManagedProcess {
  child: ChildProcess;
  logStream: fs.WriteStream;
}

/**
 * Timeout constants for process management
 */
const KILL_TIMEOUT_MS = 5000; // 5 seconds timeout for process termination

/**
 * Wraps tree-kill with a timeout to prevent hanging on unresponsive processes
 */
const treeKillWithTimeout = (
  pid: number,
  signal: string,
  timeoutMs: number = KILL_TIMEOUT_MS
): Promise<void> => {
  return Promise.race([
    new Promise<void>((resolve, reject) => {
      treeKill(pid, signal, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`Kill timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

export class NodeAppManager {
  private configManager: ConfigManager;
  private gitManager: GitManager;
  private portsService: any; // Local.Services.Ports from service container
  private npmManager: NpmManager;
  private pluginManager: WordPressPluginManager;
  private pluginDetector: BundledPluginDetector;
  private siteProcessManager: any; // Local.SiteProcessManager from service container
  private siteDatabase: any; // Local.SiteDatabase from service container
  private runningProcesses: Map<string, ManagedProcess> = new Map();

  /**
   * Operation locks to prevent race conditions
   * Maps operation key (e.g., "start:appId") to the pending Promise
   */
  private operationLocks: Map<string, Promise<NodeApp>> = new Map();

  /**
   * Sync cache for apps - used by hooks that can't await async operations
   * Updated whenever apps are loaded or modified
   */
  private appSyncCache: Map<string, NodeApp[]> = new Map();

  constructor(
    configManager: ConfigManager,
    gitManager: GitManager,
    portsService: any, // Local.Services.Ports from service container
    pluginManager: WordPressPluginManager,
    siteProcessManager: any,
    siteDatabase: any
  ) {
    this.configManager = configManager;
    this.gitManager = gitManager;
    this.portsService = portsService;
    this.npmManager = new NpmManager();
    this.pluginManager = pluginManager;
    this.pluginDetector = new BundledPluginDetector();
    this.siteProcessManager = siteProcessManager;
    this.siteDatabase = siteDatabase;
  }

  /**
   * Expand tilde (~) in file paths to home directory
   * Local sometimes stores site paths with ~ instead of full path
   */
  private expandTilde(filePath: string): string {
    if (!filePath) return filePath;
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    if (filePath === '~') {
      return os.homedir();
    }
    return filePath;
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

    // Create app directory path (expand tilde if present in site.path)
    const sitePath = this.expandTilde(site.path);
    const appsDir = path.join(sitePath, 'node-apps');
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
        onProgress
      });

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository');
      }

      // Use repository root as working directory
      const workingPath = appPath;

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

      const installResult = await withTimeout(
        this.installDependencies(
          workingPath,
          appConfig.installCommand || `${packageManager} install`,
          onProgress
        ),
        TIMEOUTS.NPM_INSTALL,
        'npm install timed out after 10 minutes'
      ).catch((error) => ({
        success: false,
        error: error.message
      }));

      if (!installResult.success) {
        // Clean up on install failure
        await fs.remove(appPath);
        throw new Error(installResult.error || 'Failed to install dependencies');
      }

      // Step 4: Auto-detect build command if not specified
      let buildCommand = appConfig.buildCommand;
      if (!buildCommand) {
        const detectedBuildCommand = await this.detectBuildCommand(workingPath, packageManager);
        if (detectedBuildCommand) {
          logger.nodeApp.info('Auto-detected build command', { buildCommand: detectedBuildCommand });
          buildCommand = detectedBuildCommand;
        }
      }

      // Step 5: Build if build command available
      if (buildCommand) {
        if (onProgress) {
          onProgress({
            phase: 'building',
            progress: 60,
            message: 'Building application...'
          });
        }

        const buildResult = await withTimeout(
          this.buildApp(workingPath, buildCommand, onProgress),
          TIMEOUTS.BUILD_COMMAND,
          'Build timed out after 5 minutes'
        ).catch((error) => ({
          success: false,
          error: error.message
        }));

        if (!buildResult.success) {
          // Clean up on build failure
          await fs.remove(appPath);
          throw new Error(buildResult.error || 'Failed to build application');
        }
      }

      // Step 5: Detect and install bundled WordPress plugins
      const bundledPluginIds: string[] = [];
      let detectionResult: any = null; // Store for later activation
      try {
        detectionResult = await this.pluginDetector.detectPlugins(appPath);

        if (detectionResult.plugins.length > 0) {
          if (onProgress) {
            onProgress({
              phase: 'installing-plugins',
              progress: 70,
              message: `Detected ${detectionResult.plugins.length} bundled plugin(s)...`
            });
          }

          logger.nodeApp.info('Detected bundled plugins', { count: detectionResult.plugins.length, source: detectionResult.source });

          // Prepare plugin configs (resolve paths) before parallel installation
          const preparedPlugins = detectionResult.plugins.map((pluginConfig: any) => {
            const prepared = { ...pluginConfig };

            // For bundled plugins, resolve the path relative to the cloned repo
            if (prepared.source === 'bundled') {
              prepared.path = path.join(appPath, prepared.path);
            }

            // For zip plugins with relative paths, resolve relative to cloned repo
            if (prepared.source === 'zip') {
              const url = prepared.url;
              // Check if it's a relative path (not https:// or file://)
              if (!url.startsWith('https://') && !url.startsWith('file://')) {
                // Convert to absolute file:// URL
                const absolutePath = path.resolve(appPath, url);
                prepared.url = `file://${absolutePath}`;
              }
            }

            return prepared;
          });

          // Install all plugins in parallel for better performance
          let completedCount = 0;
          const installPromises = preparedPlugins.map(async (pluginConfig: any) => {
            if (onProgress) {
              onProgress({
                phase: 'installing-plugins',
                progress: 70 + (completedCount / preparedPlugins.length) * 15,
                message: `Installing plugin: ${pluginConfig.slug}...`
              });
            }

            const installedPlugin = await this.pluginManager.installPlugin(
              site,
              {
                ...pluginConfig,
                name: pluginConfig.slug // Use slug as name if not specified
              },
              (pluginProgress) => {
                // Forward plugin installation progress
                if (onProgress) {
                  onProgress({
                    phase: 'installing-plugins',
                    progress: 70 + (completedCount / preparedPlugins.length) * 15,
                    message: pluginProgress.message
                  });
                }
              },
              { skipActivation: true } // Activation handled separately after site starts
            );

            completedCount++;
            logger.nodeApp.info('Installed bundled plugin', { slug: installedPlugin.slug, id: installedPlugin.id });
            return installedPlugin;
          });

          const installedPlugins = await Promise.all(installPromises);
          bundledPluginIds.push(...installedPlugins.map(p => p.id));
        }
      } catch (pluginError: any) {
        // Log plugin installation errors but don't fail the entire app installation
        logger.nodeApp.error('Failed to install bundled plugins', { error: pluginError.message });
        // Continue with app installation even if plugins fail
      }

      // Step 5a: Activate bundled plugins with autoActivate: true
      try {
        if (detectionResult && detectionResult.plugins) {
          const pluginsToActivate = detectionResult.plugins.filter((p: any) => p.autoActivate);

          if (pluginsToActivate.length > 0) {
            logger.nodeApp.info('Activating plugins with autoActivate: true', { count: pluginsToActivate.length });

            // Check site state and start if needed
            const siteStatus = this.siteProcessManager.getSiteStatus(site);
            const wasRunning = siteStatus === 'running';
            let needsStop = false;

            if (!wasRunning) {
              logger.nodeApp.info('Site not running, starting temporarily for plugin activation');
              await this.siteProcessManager.start(site);
              needsStop = true;
            }

            // Wait for database to be ready (with timeout)
            const dbReady = await withTimeout(
              this.siteDatabase.waitForDB(site),
              TIMEOUTS.DATABASE_READY,
              'Database readiness check timed out after 30 seconds'
            ).catch(() => false);
            if (!dbReady) {
              logger.nodeApp.warn('Database not ready, skipping plugin activation');
            } else {
              // Activate each plugin
              for (const pluginConfig of pluginsToActivate) {
                try {
                  const result = await this.pluginManager.activatePlugin(site, pluginConfig.slug);
                  if (result.success) {
                    logger.nodeApp.info('Activated plugin', { slug: pluginConfig.slug });
                  } else {
                    logger.nodeApp.warn('Failed to activate plugin', { slug: pluginConfig.slug, error: result.error });
                  }
                } catch (activationError: unknown) {
                  logger.nodeApp.warn('Error activating plugin', { slug: pluginConfig.slug, error: getErrorMessage(activationError) });
                }
              }
            }

            // Restore site state - stop if we started it
            if (needsStop) {
              logger.nodeApp.info('Stopping site (restoring original state)');
              await this.siteProcessManager.stop(site, { dumpDatabase: false });
            }
          }
        }
      } catch (activationError: any) {
        // Log activation errors but don't fail the entire app installation
        logger.nodeApp.error('Failed to activate bundled plugins', { error: activationError.message });
        // Continue with app installation even if activation fails
      }

      // Step 6: Allocate port using Local's Ports service
      const port = await this.portsService.getAvailablePort();
      logger.nodeApp.info('Allocated port via Local Ports service', { port, appId });

      // Step 7: Create app configuration
      const app: NodeApp = {
        id: appId,
        name: appConfig.name,
        gitUrl: appConfig.gitUrl,
        branch: appConfig.branch || 'main',
        installCommand: appConfig.installCommand || `${packageManager} install`,
        buildCommand: buildCommand || '',
        startCommand: appConfig.startCommand || 'npm start',
        nodeVersion: appConfig.nodeVersion || '20.x',
        env: appConfig.env || {},
        status: 'stopped',
        autoStart: appConfig.autoStart ?? false,
        injectWpEnv: appConfig.injectWpEnv ?? true, // Default to true - auto-inject WP env vars
        bundledPlugins: bundledPluginIds.length > 0 ? bundledPluginIds : undefined,
        path: appPath,
        port,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Step 6: Save configuration (use expanded sitePath)
      await this.configManager.saveApp(site.id, sitePath, app);

      // Update sync cache after modification
      const allApps = await this.configManager.loadApps(site.id, sitePath);
      this.appSyncCache.set(site.id, allApps);

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
      } catch (cleanupError: unknown) {
        logger.nodeApp.warn('Cleanup failed after app installation error', { appPath, error: getErrorMessage(cleanupError) });
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

    // Update sync cache after modification
    const allApps = await this.configManager.loadApps(siteId, sitePath);
    this.appSyncCache.set(siteId, allApps);

    logger.nodeApp.info('Updated app', { appId, updates });

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

    // Remove from config (Local's Ports service handles port cleanup)
    await this.configManager.removeApp(siteId, sitePath, appId);

    // Update sync cache after modification
    const allApps = await this.configManager.loadApps(siteId, sitePath);
    this.appSyncCache.set(siteId, allApps);

    logger.nodeApp.info('Removed app', { appId });
  }

  /**
   * Remove all apps for a site
   */
  async removeAllAppsForSite(siteId: string, sitePath: string): Promise<void> {
    const apps = await this.configManager.loadApps(siteId, sitePath);

    for (const app of apps) {
      await this.removeApp(siteId, sitePath, app.id);
    }

    // Clear sync cache after removing all apps
    this.appSyncCache.delete(siteId);
  }

  /**
   * Start an app with operation locking to prevent race conditions
   * If a start operation is already in progress for this app, returns the existing promise
   */
  async startApp(siteId: string, sitePath: string, appId: string, site?: any): Promise<NodeApp> {
    const lockKey = `start:${appId}`;

    // Check if an operation is already in progress
    const existingOperation = this.operationLocks.get(lockKey);
    if (existingOperation) {
      logger.nodeApp.debug('Start operation already in progress, returning existing promise', { appId });
      return existingOperation;
    }

    // Create the operation promise and store it
    const operation = this.startAppInternal(siteId, sitePath, appId, site);
    this.operationLocks.set(lockKey, operation);

    try {
      return await operation;
    } finally {
      // Clean up the lock when operation completes (success or failure)
      this.operationLocks.delete(lockKey);
    }
  }

  /**
   * Internal start app implementation
   */
  private async startAppInternal(siteId: string, sitePath: string, appId: string, site?: any): Promise<NodeApp> {
    const app = await this.configManager.getApp(siteId, sitePath, appId);

    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    // Check if already running (status check)
    if (app.status === 'running') {
      logger.nodeApp.info('App is already running (status check)', { appName: app.name, appId });
      return app; // Already running
    }

    // Check if process already exists (defensive check for duplicate starts)
    if (this.runningProcesses.has(appId)) {
      logger.nodeApp.info('App already has a running process (defensive check)', { appName: app.name, appId });
      // Update status to match reality
      app.status = 'running';
      await this.configManager.saveApp(siteId, sitePath, app);
      return app;
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
      // Get app directory (repository root)
      const appDir = app.path || path.join(sitePath, 'node-apps', appId);

      // Verify directory exists
      if (!await fs.pathExists(appDir)) {
        throw new Error(`App directory not found: ${appDir}`);
      }

      // Use validated and sanitized command
      let [command, ...args] = commandValidation.sanitizedCommand!;

      // Handle package manager commands (npm, yarn, pnpm, npx)
      if (NpmManager.isPackageManagerCommand(command)) {
        const npmInfo = await this.npmManager.getNpmInfo();

        if (npmInfo.type === 'bundled') {
          // Use bundled npm with Local's Node.js
          command = process.execPath;
          args = [npmInfo.path, ...args];
          logger.nodeApp.debug('Using bundled npm', { npmPath: npmInfo.path });
        } else {
          // Use system npm with resolved path (shell: false for security)
          const resolvedNpmPath = this.npmManager.getResolvedNpmPath();
          if (resolvedNpmPath) {
            command = resolvedNpmPath;
            // args stays the same (e.g., ['start'] for 'npm start')
            logger.nodeApp.debug('Using system npm with resolved path', { npmPath: resolvedNpmPath });
          } else {
            // Fallback: if path resolution failed, throw error
            throw new Error('System npm detected but path resolution failed');
          }
        }
      } else if (command === 'node') {
        // Use Local's bundled Node.js for direct node commands
        command = process.execPath;
        logger.nodeApp.debug('Using Local bundled Node.js', { execPath: command });
      }

      // Build environment variables from allowlist (security: don't inherit full parent env)
      // Only essential system variables are inherited
      const ALLOWED_PARENT_ENV = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'TMPDIR'];
      let env: Record<string, string> = {};

      // Copy only allowed parent env vars
      for (const key of ALLOWED_PARENT_ENV) {
        if (process.env[key]) {
          env[key] = process.env[key]!;
        }
      }

      // Add required app env vars
      env.PORT = app.port?.toString() || '3000';
      env.NODE_ENV = 'development';
      // Enable Node.js mode in Electron (required for process.execPath)
      env.ELECTRON_RUN_AS_NODE = '1';

      // Inject WordPress environment variables if enabled
      if (app.injectWpEnv) {
        try {
          const wpEnv = WordPressEnvManager.extractWordPressEnv(site);

          // Log successful extraction (sanitized)
          const sanitizedWpEnv = WordPressEnvManager.sanitizeForLogging(wpEnv);
          logger.nodeApp.info('Injecting WordPress environment variables', { appName: app.name, wpEnv: sanitizedWpEnv });

          // Merge WordPress env vars with app env
          env = {
            ...env,
            ...wpEnv,
            ...app.env // App-specific env vars take precedence
          };
        } catch (error: any) {
          // Log warning but continue - app can still run without WP env vars
          logger.nodeApp.warn('Failed to extract WordPress environment, app will start without WP env vars', { appName: app.name, error: error.message });

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
        ? path.join(os.homedir(), sitePath.slice(1))
        : sitePath;

      const logsDir = path.join(absoluteSitePath, 'logs', 'node-apps');
      await fs.ensureDir(logsDir);
      const logFile = path.join(logsDir, `${appId}.log`);

      // Log the path for debugging
      logger.nodeApp.debug('Creating log file', { logFile });

      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      // Log spawn details
      logStream.write(`\n=== Starting app at ${new Date().toISOString()} ===\n`);
      logStream.write(`Working directory: ${appDir}\n`);
      logStream.write(`Node.js: ${command === process.execPath ? `Local bundled (${command})` : command}\n`);
      logStream.write(`Command: ${command} ${args.join(' ')}\n`);
      logStream.write(`PORT: ${env.PORT}\n`);
      logStream.write(`========================================\n\n`);

      // Spawn process with security: shell: false prevents command injection
      const child = spawn(command, args, {
        cwd: appDir,
        env,
        shell: false,
        detached: false
      });

      // Immediately log if spawn succeeded
      if (child.pid) {
        logStream.write(`Process spawned with PID: ${child.pid}\n`);
      } else {
        logStream.write(`WARNING: Process spawned but no PID assigned\n`);
      }

      // Store process and log stream reference for proper cleanup
      this.runningProcesses.set(appId, { child, logStream });

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

        // Log process exit
        logger.nodeApp.info('App process exited', { appName: app.name, appId, exitCode: code, signal });

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
            logger.nodeApp.debug('Exit handler updated status to stopped', { appName: app.name });
          } else {
            logger.nodeApp.debug('Exit handler skipping status update (app is being stopped by stopApp)');
          }
        }
      });

      // Handle process error
      child.on('error', async (error) => {
        const errorMessage = `\n=== Process ERROR at ${new Date().toISOString()} ===\nError: ${error.message}\nStack: ${error.stack}\n`;
        logStream.write(errorMessage);

        // Log process error
        logger.nodeApp.error('App process error', { appName: app.name, appId, error: error.message });

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
    const managed = this.runningProcesses.get(appId);
    if (managed && managed.child.pid) {
      // Helper to clean up resources
      const cleanupResources = () => {
        // End the log stream if it's still writable
        if (managed.logStream && !managed.logStream.destroyed) {
          managed.logStream.write(`\n=== Process stopped by stopApp at ${new Date().toISOString()} ===\n`);
          managed.logStream.end();
        }
        this.runningProcesses.delete(appId);
      };

      try {
        // Try graceful SIGTERM with timeout
        await treeKillWithTimeout(managed.child.pid, 'SIGTERM');
        logger.nodeApp.info('App stopped successfully (SIGTERM)', { appId });
      } catch (sigtermError) {
        // SIGTERM failed or timed out, try force kill
        logger.nodeApp.warn('SIGTERM failed or timed out, trying SIGKILL', { appId, error: (sigtermError as Error).message });
        try {
          await treeKillWithTimeout(managed.child.pid, 'SIGKILL', 3000); // Shorter timeout for SIGKILL
          logger.nodeApp.info('App stopped (SIGKILL)', { appId });
        } catch (sigkillError) {
          // Even SIGKILL failed - log but continue with cleanup
          logger.nodeApp.error('SIGKILL failed', { appId, error: (sigkillError as Error).message });
        }
      }

      // Clean up resources regardless of kill result
      cleanupResources();

      // Update app status
      const freshApp = await this.configManager.getApp(siteId, sitePath, appId);
      if (freshApp) {
        freshApp.status = 'stopped';
        freshApp.pid = undefined;
        await this.configManager.saveApp(siteId, sitePath, freshApp);
      }

      // Return the original app object with updated status
      app.status = 'stopped';
      app.pid = undefined;
      return app;
    } else {
      logger.nodeApp.debug('No running process, just updating status', { appId });
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
    const apps = await this.configManager.loadApps(siteId, sitePath);
    // Update sync cache for use by hooks
    this.appSyncCache.set(siteId, apps);
    return apps;
  }

  /**
   * Get synchronous version for sites (used by hooks that can't await)
   * Returns cached apps or empty array if not yet loaded
   */
  getAppsForSiteSync(siteId: string): NodeApp[] {
    return this.appSyncCache.get(siteId) || [];
  }

  /**
   * Update the sync cache for a site
   * Called after app modifications to keep cache current
   */
  updateSyncCache(siteId: string, apps: NodeApp[]): void {
    this.appSyncCache.set(siteId, apps);
  }

  /**
   * Clear the sync cache for a site
   */
  clearSyncCache(siteId: string): void {
    this.appSyncCache.delete(siteId);
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
   * Detect package manager from lockfiles (parallelized for performance)
   */
  private async detectPackageManager(appPath: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
    // Define lockfiles in priority order (bun > pnpm > yarn > npm)
    const lockfiles: Array<{ file: string; manager: 'npm' | 'yarn' | 'pnpm' | 'bun' }> = [
      { file: 'bun.lockb', manager: 'bun' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' }
    ];

    // Check all lockfiles in parallel for better performance
    const checks = await Promise.all(
      lockfiles.map(async ({ file, manager }) => ({
        exists: await fs.pathExists(path.join(appPath, file)),
        manager
      }))
    );

    // Return first matching manager (respects priority order)
    const found = checks.find(c => c.exists);
    return found?.manager ?? 'npm';
  }

  /**
   * Detect build command from package.json
   */
  private async detectBuildCommand(appPath: string, packageManager: string): Promise<string | undefined> {
    try {
      const packageJsonPath = path.join(appPath, 'package.json');

      if (!await fs.pathExists(packageJsonPath)) {
        return undefined;
      }

      const packageJson = await fs.readJson(packageJsonPath);

      // Check if there's a build script
      if (packageJson.scripts && packageJson.scripts.build) {
        // Return the appropriate command based on package manager
        switch (packageManager) {
          case 'yarn':
            return 'yarn build';
          case 'pnpm':
            return 'pnpm build';
          case 'bun':
            return 'bun run build';
          default:
            return 'npm run build';
        }
      }

      return undefined;
    } catch (error: any) {
      logger.nodeApp.error('Error detecting build command', { error: error.message });
      return undefined;
    }
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
        env: getSafeEnv()
      });

      let errorOutput = '';
      const MAX_ERROR_BUFFER = 1024 * 1024; // 1MB limit for error output

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        if (onOutput) onOutput(output);
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        // Limit error buffer size to prevent memory exhaustion
        if (errorOutput.length < MAX_ERROR_BUFFER) {
          errorOutput += output.slice(0, MAX_ERROR_BUFFER - errorOutput.length);
        }
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
