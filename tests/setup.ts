/**
 * Jest Test Setup
 * Runs before each test file
 */

import { resetAllMocks } from './__mocks__/local-main';
import { resetElectronMocks } from './__mocks__/electron';

// Extend Jest matchers
import '@testing-library/jest-dom';

// Reset all mocks before each test
beforeEach(() => {
  resetAllMocks();
  resetElectronMocks();
  jest.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(10000);

// Suppress console output during tests unless explicitly testing console
const originalConsole = { ...console };

beforeAll(() => {
  // Optionally suppress console during tests
  // Uncomment to silence console output:
  // global.console = {
  //   ...console,
  //   log: jest.fn(),
  //   debug: jest.fn(),
  //   info: jest.fn(),
  //   warn: jest.fn(),
  //   error: jest.fn(),
  // };
});

afterAll(() => {
  global.console = originalConsole;
});
