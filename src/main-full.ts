import * as LocalMain from '@getflywheel/local/main';
import * as Local from '@getflywheel/local';
import * as path from 'path';
import * as fs from 'fs-extra';
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
  LocalMain.addIpcAsyncListener<AddAppRequest, AddAppResponse>(
    'node-orchestrator:add-app',
    async (request) => {
      try {
        const site = siteData.getSite(request.siteId);
        if (!site) {
          throw new Error(`Site ${request.siteId} not found`);
        }

        const app = await appManager.addApp(site, request.app);
        
        return {
          success: true,
          app
        };
      } catch (error) {
        localLogger.error('Failed to add Node.js app', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<RemoveAppRequest, AddAppResponse>(
    'node-orchestrator:remove-app',
    async (request) => {
      try {
        await appManager.removeApp(request.siteId, request.appId);
        return { success: true };
      } catch (error) {
        localLogger.error('Failed to remove Node.js app', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<StartAppRequest, AddAppResponse>(
    'node-orchestrator:start-app',
    async (request) => {
      try {
        const app = await appManager.startApp(request.siteId, request.appId);
        return {
          success: true,
          app
        };
      } catch (error) {
        localLogger.error('Failed to start Node.js app', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<StopAppRequest, AddAppResponse>(
    'node-orchestrator:stop-app',
    async (request) => {
      try {
        const app = await appManager.stopApp(request.siteId, request.appId);
        return {
          success: true,
          app
        };
      } catch (error) {
        localLogger.error('Failed to stop Node.js app', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<GetAppsRequest, GetAppsResponse>(
    'node-orchestrator:get-apps',
    async (request) => {
      try {
        const apps = await appManager.getAppsForSite(request.siteId);
        return {
          success: true,
          apps
        };
      } catch (error) {
        localLogger.error('Failed to get Node.js apps', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<GetLogsRequest, GetLogsResponse>(
    'node-orchestrator:get-logs',
    async (request) => {
      try {
        const logs = await appManager.getAppLogs(
          request.siteId,
          request.appId,
          request.lines || 100
        );
        return {
          success: true,
          logs
        };
      } catch (error) {
        localLogger.error('Failed to get app logs', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

  LocalMain.addIpcAsyncListener<UpdateEnvRequest, UpdateEnvResponse>(
    'node-orchestrator:update-env',
    async (request) => {
      try {
        await appManager.updateAppEnv(
          request.siteId,
          request.appId,
          request.env
        );

        // Restart app if running
        const app = await appManager.getApp(request.siteId, request.appId);
        if (app && app.status === 'running') {
          await appManager.restartApp(request.siteId, request.appId);
        }

        return { success: true };
      } catch (error) {
        localLogger.error('Failed to update app environment', { error, request });
        return {
          success: false,
          error: error.message
        };
      }
    }
  );

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
