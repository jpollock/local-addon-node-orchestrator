import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import rendererFunction from '../renderer';

describe('Node.js Orchestrator Renderer', () => {
  let mockContext: any;
  let mockHooks: any;
  let mockElectron: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockElectron = {
      ipcRenderer: {
        invoke: jest.fn()
      }
    };

    mockHooks = {
      addContent: jest.fn()
    };

    mockContext = {
      React: React,
      hooks: mockHooks,
      electron: mockElectron
    };

    // Mock window.electron as fallback
    (global as any).window = {
      electron: mockElectron
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  describe('Initialization', () => {
    it('should register component with SiteInfoOverview hook', () => {
      rendererFunction(mockContext);

      expect(mockHooks.addContent).toHaveBeenCalledWith(
        'SiteInfoOverview',
        expect.any(Function)
      );
    });

    it('should create NodeAppsInfo component function', () => {
      rendererFunction(mockContext);

      const NodeAppsInfo = mockHooks.addContent.mock.calls[0][1];
      expect(typeof NodeAppsInfo).toBe('function');
    });
  });

  describe('Component Rendering', () => {
    let NodeAppsInfo: any;

    beforeEach(() => {
      rendererFunction(mockContext);
      NodeAppsInfo = mockHooks.addContent.mock.calls[0][1];
    });

    it('should return null when site is not provided', () => {
      const result = NodeAppsInfo({ site: null });
      expect(result).toBeNull();
    });

    it('should return null when site is undefined', () => {
      const result = NodeAppsInfo({});
      expect(result).toBeNull();
    });

    it('should render NodeAppsManager component when site is provided', () => {
      const mockSite = { id: 'site-123', name: 'Test Site' };
      const result = NodeAppsInfo({ site: mockSite });

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.props.site).toEqual(mockSite);
    });
  });

  describe('NodeAppsManager Component', () => {
    let NodeAppsManager: any;
    let mockSite: any;

    beforeEach(() => {
      rendererFunction(mockContext);
      const NodeAppsInfo = mockHooks.addContent.mock.calls[0][1];
      mockSite = { id: 'site-123', name: 'Test Site' };
      const element = NodeAppsInfo({ site: mockSite });
      NodeAppsManager = element.type;
    });

    it('should be a React Component class', () => {
      expect(NodeAppsManager.prototype).toBeInstanceOf(React.Component);
    });

    it('should initialize with empty testResult state', () => {
      const instance = new NodeAppsManager({ site: mockSite });
      expect(instance.state.testResult).toBe('');
    });

    describe('IPC Communication', () => {
      it('should handle successful IPC test', async () => {
        const instance = new NodeAppsManager({ site: mockSite });
        instance.setState = jest.fn();

        const mockResponse = { success: true, data: 'test' };
        mockElectron.ipcRenderer.invoke.mockResolvedValue(mockResponse);

        await instance.testIPC();

        expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
          'node-orchestrator:test',
          {
            siteId: 'site-123',
            message: 'Testing IPC communication'
          }
        );

        expect(instance.setState).toHaveBeenCalledWith({
          testResult: `IPC Response: ${JSON.stringify(mockResponse)}`
        });
      });

      it('should handle IPC errors', async () => {
        const instance = new NodeAppsManager({ site: mockSite });
        instance.setState = jest.fn();

        const error = new Error('IPC failed');
        mockElectron.ipcRenderer.invoke.mockRejectedValue(error);

        await instance.testIPC();

        expect(instance.setState).toHaveBeenCalledWith({
          testResult: 'Error: IPC failed'
        });
      });

      it('should handle missing electron context', async () => {
        delete mockContext.electron;
        delete (global as any).window.electron;

        rendererFunction(mockContext);
        const NodeAppsInfo = mockHooks.addContent.mock.calls[1][1];
        const element = NodeAppsInfo({ site: mockSite });
        const NewNodeAppsManager = element.type;

        const instance = new NewNodeAppsManager({ site: mockSite });
        instance.setState = jest.fn();

        await instance.testIPC();

        expect(instance.setState).toHaveBeenCalledWith({
          testResult: 'Error: Electron not available'
        });
      });
    });

    describe('UI Elements', () => {
      it('should render correct UI structure', () => {
        const instance = new NodeAppsManager({ site: mockSite });
        const rendered = instance.render();

        expect(rendered.type).toBe('div');
        expect(rendered.props.style).toMatchObject({
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          marginTop: '20px'
        });
      });

      it('should display site name in content', () => {
        const instance = new NodeAppsManager({ site: mockSite });
        const rendered = instance.render();

        const paragraph = rendered.props.children[1];
        expect(paragraph.type).toBe('p');
        expect(paragraph.props.children).toContain('Test Site');
      });

      it('should render test button with correct props', () => {
        const instance = new NodeAppsManager({ site: mockSite });
        const rendered = instance.render();

        const button = rendered.props.children[2];
        expect(button.type).toBe('button');
        expect(button.props.onClick).toBe(instance.testIPC);
        expect(button.props.children).toBe('Test IPC Connection');
      });

      it('should display test results when available', () => {
        const instance = new NodeAppsManager({ site: mockSite });
        instance.state.testResult = 'Test passed!';
        const rendered = instance.render();

        const resultDiv = rendered.props.children[3];
        expect(resultDiv).toBeDefined();
        expect(resultDiv.type).toBe('div');
        
        const small = resultDiv.props.children;
        expect(small.type).toBe('small');
        expect(small.props.children).toBe('Test passed!');
      });

      it('should not display results div when testResult is empty', () => {
        const instance = new NodeAppsManager({ site: mockSite });
        const rendered = instance.render();

        const resultDiv = rendered.props.children[3];
        expect(resultDiv).toBeFalsy();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle full component lifecycle', async () => {
      rendererFunction(mockContext);
      const NodeAppsInfo = mockHooks.addContent.mock.calls[0][1];
      
      const mockSite = { id: 'site-456', name: 'Integration Test Site' };
      const element = NodeAppsInfo({ site: mockSite });
      const NodeAppsManager = element.type;
      
      const instance = new NodeAppsManager({ site: mockSite });
      
      // Initial state
      expect(instance.state.testResult).toBe('');
      
      // Simulate IPC test
      mockElectron.ipcRenderer.invoke.mockResolvedValue({
        success: true,
        message: 'Integration test successful'
      });
      
      await instance.testIPC();
      
      // Verify IPC was called correctly
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        'node-orchestrator:test',
        {
          siteId: 'site-456',
          message: 'Testing IPC communication'
        }
      );
    });
  });
});