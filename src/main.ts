import * as LocalMain from '@getflywheel/local/main';
import { ipcMain } from 'electron';

export default function (context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  localLogger.log('info', 'Node.js Orchestrator v1.0.2 addon loaded successfully');

  context.hooks.addAction('siteStarted', (site: any) => {
    localLogger.log('info', `Site ${site.name} started - Node.js Orchestrator ready`);
  });

  // Simple test IPC - using correct Electron IPC handler
  ipcMain.handle('node-orchestrator:test', async (_event, data: any) => {
    try {
      localLogger.log('info', 'Test IPC received', data);

      // Validate input
      if (!data || typeof data.siteId !== 'string') {
        return {
          success: false,
          error: 'Invalid request: siteId required'
        };
      }

      return {
        success: true,
        message: 'Node.js Orchestrator v1.0.2 is working!',
        data
      };
    } catch (error: any) {
      localLogger.log('error', 'IPC handler error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  });

  localLogger.log('info', 'Successfully registered IPC handler for node-orchestrator:test');
  localLogger.log('info', 'Node.js Orchestrator v1.0.2 initialized');
}