import * as LocalMain from '@getflywheel/local/main';
import * as Local from '@getflywheel/local';
import { ipcMain } from 'electron';
import { GitManager } from './lib/GitManager';
import { NodeAppManager } from './lib/NodeAppManager';
import { ConfigManager } from './lib/ConfigManager';
import {
  AddAppRequestSchema,
  StartAppRequestSchema,
  StopAppRequestSchema,
  RemoveAppRequestSchema,
  GetAppsRequestSchema,
  GetLogsRequestSchema,
  UpdateEnvRequestSchema,
  validate
} from './security/schemas';
import { logAndSanitizeError } from './security/errors';

export default function (context: LocalMain.AddonMainContext): void {
  const { localLogger, siteData } = LocalMain.getServiceContainer().cradle;

  console.log('[Node Orchestrator] Main addon loading...');
  console.log('[Node Orchestrator] Available hooks:', Object.keys(context.hooks || {}));

  // Initialize managers
  const configManager = new ConfigManager();
  const gitManager = new GitManager();
  const appManager = new NodeAppManager(configManager, gitManager);

  console.log('[Node Orchestrator] Managers initialized');

  // Site lifecycle hooks
  context.hooks.addAction('siteStarted', async (site: Local.Site) => {
    try {
      const apps = await appManager.getAppsForSite(site.id, site.path);
      const autoStartApps = apps.filter(app => app.autoStart);

      for (const app of autoStartApps) {
        await appManager.startApp(site.id, site.path, app.id);
      }

      localLogger.log('info', `Started ${autoStartApps.length} Node.js apps for ${site.name}`);
    } catch (error) {
      localLogger.error('Failed to start Node.js apps', { error, siteId: site.id });
    }
  });

  // Try multiple hook names to ensure we catch site stopping
  const stopAppsForSite = async (site: Local.Site, hookName: string) => {
    try {
      console.log(`[Node Orchestrator] ${hookName} hook fired for ${site.name}`);
      localLogger.log('info', `${hookName} - checking for Node.js apps to stop`, { siteName: site.name, siteId: site.id });

      const apps = await appManager.getAppsForSite(site.id, site.path);
      localLogger.log('info', `Found ${apps.length} Node.js apps`, { apps: apps.map(a => ({ id: a.id, name: a.name, status: a.status })) });

      // Stop ALL apps, regardless of status (safer approach)
      let stoppedCount = 0;
      for (const app of apps) {
        try {
          console.log(`[Node Orchestrator] Stopping app ${app.name} (${app.id})`);
          localLogger.log('info', `Attempting to stop app ${app.name}`, { appId: app.id, status: app.status });
          await appManager.stopApp(site.id, site.path, app.id);
          stoppedCount++;
        } catch (error) {
          console.error(`[Node Orchestrator] Failed to stop ${app.name}:`, error);
          localLogger.error(`Failed to stop app ${app.name}`, { error, appId: app.id });
        }
      }

      console.log(`[Node Orchestrator] Stopped ${stoppedCount} apps for ${site.name}`);
      localLogger.log('info', `Stopped ${stoppedCount} Node.js apps for ${site.name}`);
    } catch (error) {
      console.error(`[Node Orchestrator] Error in ${hookName}:`, error);
      localLogger.error('Failed to stop Node.js apps', { error, siteId: site.id });
    }
  };

  // Register multiple hooks to ensure we catch site stopping
  context.hooks.addAction('siteStopping', (site: Local.Site) => stopAppsForSite(site, 'siteStopping'));
  context.hooks.addAction('siteStopped', (site: Local.Site) => stopAppsForSite(site, 'siteStopped'));
  context.hooks.addAction('siteStop', (site: Local.Site) => stopAppsForSite(site, 'siteStop'));

  context.hooks.addAction('siteDeleting', async (site: Local.Site) => {
    try {
      await appManager.removeAllAppsForSite(site.id, site.path);
      localLogger.log('info', `Cleaned up Node.js apps for ${site.name}`);
    } catch (error) {
      localLogger.error('Failed to clean up Node.js apps', { error, siteId: site.id });
    }
  });

  // IPC Handlers
  ipcMain.handle('node-orchestrator:add-app', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(AddAppRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid add-app request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for add-app request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      localLogger.info('Adding Node.js app', {
        siteId: validatedRequest.siteId,
        appName: validatedRequest.app.name
      });

      const app = await appManager.addApp(site, validatedRequest.app);

      localLogger.info('Successfully added Node.js app', {
        siteId: validatedRequest.siteId,
        appId: app.id
      });

      return {
        success: true,
        app
      };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to add Node.js app', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:remove-app', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(RemoveAppRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid remove-app request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for remove-app request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      localLogger.info('Removing Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      await appManager.removeApp(validatedRequest.siteId, site.path, validatedRequest.appId);

      localLogger.info('Successfully removed Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      return { success: true };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to remove Node.js app', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:start-app', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(StartAppRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid start-app request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for start-app request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      localLogger.info('Starting Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      const app = await appManager.startApp(validatedRequest.siteId, site.path, validatedRequest.appId);

      localLogger.info('Successfully started Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      return {
        success: true,
        app
      };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to start Node.js app', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:stop-app', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(StopAppRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid stop-app request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for stop-app request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      localLogger.info('Stopping Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      const app = await appManager.stopApp(validatedRequest.siteId, site.path, validatedRequest.appId);

      localLogger.info('Successfully stopped Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      return {
        success: true,
        app
      };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to stop Node.js app', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:get-apps', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(GetAppsRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid get-apps request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for get-apps request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      const apps = await appManager.getAppsForSite(validatedRequest.siteId, site.path);
      return {
        success: true,
        apps
      };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to get Node.js apps', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:get-logs', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(GetLogsRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid get-logs request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for get-logs request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      const logs = await appManager.getAppLogs(
        validatedRequest.siteId,
        site.path,
        validatedRequest.appId,
        validatedRequest.lines
      );
      return {
        success: true,
        logs
      };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to get app logs', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  ipcMain.handle('node-orchestrator:update-env', async (_event, request: unknown) => {
    try {
      // Validate input
      const validation = validate(UpdateEnvRequestSchema, request);
      if (!validation.success) {
        localLogger.warn('Invalid update-env request', { validationError: validation.error });
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      const validatedRequest = validation.data;
      const site = siteData.getSite(validatedRequest.siteId);
      if (!site) {
        localLogger.warn('Site not found for update-env request', { siteId: validatedRequest.siteId });
        throw new Error(`Site not found`);
      }

      localLogger.info('Updating app environment', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      await appManager.updateAppEnv(
        validatedRequest.siteId,
        site.path,
        validatedRequest.appId,
        validatedRequest.env
      );

      // Restart app if running
      const app = await appManager.getApp(validatedRequest.siteId, site.path, validatedRequest.appId);
      if (app && app.status === 'running') {
        localLogger.info('Restarting app after env update', {
          siteId: validatedRequest.siteId,
          appId: validatedRequest.appId
        });
        await appManager.restartApp(validatedRequest.siteId, site.path, validatedRequest.appId);
      }

      localLogger.info('Successfully updated app environment', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      return { success: true };
    } catch (error: unknown) {
      const sanitizedError = logAndSanitizeError(localLogger, 'Failed to update app environment', error);
      return {
        success: false,
        error: sanitizedError
      };
    }
  });

  // Environment variable filter for WordPress integration
  context.hooks.addFilter(
    'siteShellEnvironment',
    (env: NodeJS.ProcessEnv, site: Local.Site) => {
      const apps = appManager.getAppsForSiteSync(site.id);
      const runningApps = apps.filter(app => app.status === 'running');

      // Add environment variables for running Node.js apps
      runningApps.forEach((app, index) => {
        const prefix = app.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        env[`${prefix}_URL`] = `http://localhost:${app.port}`;
        env[`${prefix}_PORT`] = app.port?.toString() || '';
        env[`NODE_APP_${index}_URL`] = `http://localhost:${app.port}`;
      });

      return env;
    }
  );

  // Log initialization
  localLogger.log('info', 'Node.js Orchestrator addon loaded');
}
