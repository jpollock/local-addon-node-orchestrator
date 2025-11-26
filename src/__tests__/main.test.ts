// Mock electron before imports
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

// Mock internal modules to prevent initialization side effects
jest.mock('../lib/GitManager');
jest.mock('../lib/NodeAppManager');
jest.mock('../lib/ConfigManager');
jest.mock('../lib/wordpress/WpCliManager');
jest.mock('../lib/wordpress/WordPressPluginManager');
jest.mock('../utils/logger', () => ({
  initializeLogger: jest.fn(),
  logger: {
    main: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    nodeApp: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    wpPlugin: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    git: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ipc: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }
}));

// Mock Local services - must be a factory function
jest.mock('@getflywheel/local/main', () => ({
  getServiceContainer: jest.fn()
}));

import * as LocalMain from '@getflywheel/local/main';
import { ipcMain } from 'electron';

describe('Node.js Orchestrator Main Process (Full Version)', () => {
  let mockContext: any;
  let mockLocalLogger: any;
  let mockServices: any;
  let mainFunction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocalLogger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockServices = {
      localLogger: mockLocalLogger,
      siteData: { getSite: jest.fn() },
      siteProcessManager: { getSiteStatus: jest.fn() },
      siteDatabase: { waitForDB: jest.fn() },
      ports: { getAvailablePort: jest.fn() },
      wpCli: { run: jest.fn() }
    };

    (LocalMain.getServiceContainer as jest.Mock).mockReturnValue({
      cradle: mockServices
    });

    mockContext = {
      hooks: {
        addAction: jest.fn(),
        addFilter: jest.fn()
      }
    };

    // Clear module cache and re-require to get fresh instance with new mocks
    jest.resetModules();

    // Re-apply mocks after module reset
    jest.doMock('@getflywheel/local/main', () => ({
      getServiceContainer: jest.fn().mockReturnValue({
        cradle: mockServices
      })
    }));

    jest.doMock('electron', () => ({
      ipcMain: {
        handle: jest.fn()
      }
    }));

    mainFunction = require('../main-full').default;
  });

  describe('Initialization', () => {
    it('should initialize the addon successfully', () => {
      expect(() => mainFunction(mockContext)).not.toThrow();
    });

    it('should initialize logger with Local logger service', () => {
      const { initializeLogger } = require('../utils/logger');

      mainFunction(mockContext);

      expect(initializeLogger).toHaveBeenCalledWith(mockLocalLogger);
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

    it('should register siteStopping hook', () => {
      mainFunction(mockContext);

      expect(mockContext.hooks.addAction).toHaveBeenCalledWith(
        'siteStopping',
        expect.any(Function)
      );
    });
  });

  describe('IPC Handlers', () => {
    it('should register IPC handlers for node app operations', () => {
      mainFunction(mockContext);

      const { ipcMain: mockedIpcMain } = require('electron');
      const registeredHandlers = (mockedIpcMain.handle as jest.Mock).mock.calls.map(
        (call: any) => call[0]
      );

      expect(registeredHandlers).toContain('node-orchestrator:add-app');
      expect(registeredHandlers).toContain('node-orchestrator:start-app');
      expect(registeredHandlers).toContain('node-orchestrator:stop-app');
      expect(registeredHandlers).toContain('node-orchestrator:remove-app');
      expect(registeredHandlers).toContain('node-orchestrator:get-apps');
    });

    it('should register IPC handlers for plugin operations', () => {
      mainFunction(mockContext);

      const { ipcMain: mockedIpcMain } = require('electron');
      const registeredHandlers = (mockedIpcMain.handle as jest.Mock).mock.calls.map(
        (call: any) => call[0]
      );

      expect(registeredHandlers).toContain('node-orchestrator:install-plugin');
      expect(registeredHandlers).toContain('node-orchestrator:activate-plugin');
      expect(registeredHandlers).toContain('node-orchestrator:deactivate-plugin');
      expect(registeredHandlers).toContain('node-orchestrator:remove-plugin');
      expect(registeredHandlers).toContain('node-orchestrator:get-plugins');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing services gracefully', () => {
      // Reset and setup mocks for missing services scenario
      jest.resetModules();

      jest.doMock('@getflywheel/local/main', () => ({
        getServiceContainer: jest.fn().mockReturnValue({
          cradle: {}
        })
      }));

      const newMainFunction = require('../main-full').default;

      // Should throw when services are missing
      expect(() => newMainFunction(mockContext)).toThrow();
    });

    it('should handle missing hooks context', () => {
      const invalidContext = {};

      expect(() => mainFunction(invalidContext)).toThrow();
    });
  });
});
