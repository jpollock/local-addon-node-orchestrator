import * as LocalMain from '@getflywheel/local/main';
import * as Local from '@getflywheel/local';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ipcMain } from 'electron';
import NodeOrchestratorService from './services/NodeOrchestratorService';
import { GitManager } from './lib/GitManager';
import { NodeAppManager } from './lib/NodeAppManager';
import { ConfigManager } from './lib/ConfigManager';
import {
  AddAppRequest,
  AddAppResponse,
  RemoveAppRequest,
  StartAppRequest,
  StopAppRequest,
  GetAppsRequest,
  GetAppsResponse,
  GetLogsRequest,
  GetLogsResponse,
  UpdateEnvRequest,
  UpdateEnvResponse,
  NodeApp,
  SiteNodeApps
} from './types';
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
  const { electron } = context;
  const { localLogger, siteData } = LocalMain.getServiceContainer().cradle;

  // Initialize managers
  const configManager = new ConfigManager();
  const gitManager = new GitManager();
  const appManager = new NodeAppManager(configManager, gitManager);

  // Register Lightning Service
  LocalMain.registerLightningService(
    NodeOrchestratorService,
    '1.0.0',
    {
      defaultEnabled: false,
      requiredFor: []
    }
  );

  // Site lifecycle hooks
  context.hooks.addAction('siteStarted', async (site: Local.Site) => {
    try {
      const apps = await appManager.getAppsForSite(site.id);
      const autoStartApps = apps.filter(app => app.autoStart);

      for (const app of autoStartApps) {
        await appManager.startApp(site.id, app.id);
      }

      localLogger.log('info', `Started ${autoStartApps.length} Node.js apps for ${site.name}`);
    } catch (error) {
      localLogger.error('Failed to start Node.js apps', { error, siteId: site.id });
    }
  });

  context.hooks.addAction('siteStopping', async (site: Local.Site) => {
    try {
      const apps = await appManager.getAppsForSite(site.id);
      
      for (const app of apps) {
        if (app.status === 'running') {
          await appManager.stopApp(site.id, app.id);
        }
      }

      localLogger.log('info', `Stopped Node.js apps for ${site.name}`);
    } catch (error) {
      localLogger.error('Failed to stop Node.js apps', { error, siteId: site.id });
    }
  });

  context.hooks.addAction('siteDeleting', async (site: Local.Site) => {
    try {
      await appManager.removeAllAppsForSite(site.id);
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

      localLogger.info('Removing Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      await appManager.removeApp(validatedRequest.siteId, validatedRequest.appId);

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
      localLogger.info('Starting Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      const app = await appManager.startApp(validatedRequest.siteId, validatedRequest.appId);

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
      localLogger.info('Stopping Node.js app', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      const app = await appManager.stopApp(validatedRequest.siteId, validatedRequest.appId);

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
      const apps = await appManager.getAppsForSite(validatedRequest.siteId);
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
      const logs = await appManager.getAppLogs(
        validatedRequest.siteId,
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
      localLogger.info('Updating app environment', {
        siteId: validatedRequest.siteId,
        appId: validatedRequest.appId
      });

      await appManager.updateAppEnv(
        validatedRequest.siteId,
        validatedRequest.appId,
        validatedRequest.env
      );

      // Restart app if running
      const app = await appManager.getApp(validatedRequest.siteId, validatedRequest.appId);
      if (app && app.status === 'running') {
        localLogger.info('Restarting app after env update', {
          siteId: validatedRequest.siteId,
          appId: validatedRequest.appId
        });
        await appManager.restartApp(validatedRequest.siteId, validatedRequest.appId);
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
