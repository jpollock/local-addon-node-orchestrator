import * as LocalMain from '@getflywheel/local/main';

jest.mock('@getflywheel/local/main', () => ({
  getServiceContainer: jest.fn(),
  addIpcAsyncListener: jest.fn()
}));

describe('Node.js Orchestrator Main Process', () => {
  let mockContext: any;
  let mockLocalLogger: any;
  let mainFunction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocalLogger = {
      log: jest.fn()
    };

    (LocalMain.getServiceContainer as jest.Mock).mockReturnValue({
      cradle: {
        localLogger: mockLocalLogger
      }
    });

    mockContext = {
      hooks: {
        addAction: jest.fn()
      }
    };

    mainFunction = require('../main').default;
  });

  describe('Initialization', () => {
    it('should initialize the addon successfully', () => {
      mainFunction(mockContext);

      expect(mockLocalLogger.log).toHaveBeenCalledWith(
        'info',
        'Node.js Orchestrator addon loaded (minimal version)'
      );

      expect(mockLocalLogger.log).toHaveBeenCalledWith(
        'info',
        'Node.js Orchestrator initialized successfully'
      );
    });

    it('should register IPC listener for test command', () => {
      mainFunction(mockContext);

      expect(LocalMain.addIpcAsyncListener).toHaveBeenCalledWith(
        'node-orchestrator:test',
        expect.any(Function)
      );
    });
  });

  describe('Site Lifecycle Hooks', () => {
    it('should register siteStarted hook', () => {
      mainFunction(mockContext);

      expect(mockContext.hooks.addAction).toHaveBeenCalledWith(
        'siteStarted',
        expect.any(Function)
      );
    });

    it('should log when site starts', () => {
      mainFunction(mockContext);

      const siteStartedCallback = mockContext.hooks.addAction.mock.calls
        .find((call: any) => call[0] === 'siteStarted')[1];

      const mockSite = { name: 'test-site', id: 'site-123' };
      siteStartedCallback(mockSite);

      expect(mockLocalLogger.log).toHaveBeenCalledWith(
        'info',
        'Site test-site started - Node.js Orchestrator ready'
      );
    });

    it('should register siteStopping hook', () => {
      mainFunction(mockContext);

      expect(mockContext.hooks.addAction).toHaveBeenCalledWith(
        'siteStopping',
        expect.any(Function)
      );
    });

    it('should log when site stops', () => {
      mainFunction(mockContext);

      const siteStoppingCallback = mockContext.hooks.addAction.mock.calls
        .find((call: any) => call[0] === 'siteStopping')[1];

      const mockSite = { name: 'test-site', id: 'site-123' };
      siteStoppingCallback(mockSite);

      expect(mockLocalLogger.log).toHaveBeenCalledWith(
        'info',
        'Site test-site stopping - cleaning up Node.js apps'
      );
    });
  });

  describe('IPC Communication', () => {
    it('should handle test IPC message', async () => {
      mainFunction(mockContext);

      const ipcHandler = (LocalMain.addIpcAsyncListener as jest.Mock).mock.calls[0][1];
      const testData = { siteId: 'site-123', message: 'Testing' };

      const result = await ipcHandler(testData);

      expect(mockLocalLogger.log).toHaveBeenCalledWith(
        'info',
        'Test IPC received',
        testData
      );

      expect(result).toEqual({
        success: true,
        message: 'Node.js Orchestrator is working!'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing logger gracefully', () => {
      (LocalMain.getServiceContainer as jest.Mock).mockReturnValue({
        cradle: {}
      });

      expect(() => mainFunction(mockContext)).toThrow();
    });

    it('should handle missing hooks context', () => {
      const invalidContext = {};

      expect(() => mainFunction(invalidContext)).toThrow();
    });
  });
});