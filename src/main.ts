import * as LocalMain from '@getflywheel/local/main';

export default function (context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  localLogger.log('info', 'Node.js Orchestrator v1.0.2 addon loaded successfully');

  context.hooks.addAction('siteStarted', (site: any) => {
    localLogger.log('info', `Site ${site.name} started - Node.js Orchestrator ready`);
  });

  // Simple test IPC
  try {
    LocalMain.addIpcAsyncListener(
      'node-orchestrator:test',
      async (data: any) => {
        localLogger.log('info', 'Test IPC received', data);
        return { success: true, message: 'Node.js Orchestrator v1.0.2 is working!' };
      }
    );
    localLogger.log('info', 'Successfully registered IPC handler for node-orchestrator:test');
  } catch (error: any) {
    localLogger.log('error', 'Failed to register IPC handler:', error.message);
  }

  localLogger.log('info', 'Node.js Orchestrator v1.0.2 initialized');
}