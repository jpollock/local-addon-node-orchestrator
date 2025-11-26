/**
 * Mock for electron
 * Provides mock IPC communication for tests
 */

// Mock IPC Main
export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock IPC Renderer
export const ipcRenderer = {
  invoke: jest.fn(() => Promise.resolve({ success: true })),
  send: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock shell
export const shell = {
  openExternal: jest.fn(() => Promise.resolve()),
  openPath: jest.fn(() => Promise.resolve(''))
};

// Mock app
export const app = {
  getPath: jest.fn((name: string) => `/mock/path/${name}`),
  getVersion: jest.fn(() => '1.0.0'),
  getName: jest.fn(() => 'Local'),
  isPackaged: false
};

// Helper to reset all mocks
export const resetElectronMocks = () => {
  Object.values(ipcMain).forEach(fn => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
  Object.values(ipcRenderer).forEach(fn => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
  Object.values(shell).forEach(fn => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
  Object.values(app).forEach(fn => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
};

export default {
  ipcMain,
  ipcRenderer,
  shell,
  app,
  resetElectronMocks
};
