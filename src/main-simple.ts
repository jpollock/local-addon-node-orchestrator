import * as LocalMain from '@getflywheel/local/main';

export default function (context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  localLogger.log('info', 'Node.js Orchestrator addon loaded successfully');

  context.hooks.addAction('siteStarted', (site: any) => {
    localLogger.log('info', `Site ${site.name} started - Node.js Orchestrator ready`);
  });

  // Simple test IPC
  LocalMain.addIpcAsyncListener(
    'node-orchestrator:test',
    async (data: any) => {
      localLogger.log('info', 'Test IPC received', data);
      return { success: true, message: 'Node.js Orchestrator is working!' };
    }
  );

  localLogger.log('info', 'Node.js Orchestrator initialized');
}