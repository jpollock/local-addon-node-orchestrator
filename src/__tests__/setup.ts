import '@testing-library/jest-dom';

// Mock electron
(global as any).electron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock console methods to reduce test output noise
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers if needed
expect.extend({
  toBeValidIpcMessage(received: any) {
    const pass = 
      received &&
      typeof received === 'object' &&
      'success' in received;

    return {
      pass,
      message: () => pass
        ? `expected ${JSON.stringify(received)} not to be a valid IPC message`
        : `expected ${JSON.stringify(received)} to be a valid IPC message with 'success' property`
    };
  }
});