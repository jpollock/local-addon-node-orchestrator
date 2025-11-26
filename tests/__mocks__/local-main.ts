/**
 * Mock for @getflywheel/local/main
 * Provides mock implementations of Local's main process services
 */

// Mock logger
export const mockLocalLogger = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn()
};

// Mock site data
export const mockSiteData = {
  getSite: jest.fn(),
  getSites: jest.fn(() => []),
  updateSite: jest.fn()
};

// Mock site process manager
export const mockSiteProcessManager = {
  getSiteStatus: jest.fn(() => 'stopped'),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  restart: jest.fn(() => Promise.resolve())
};

// Mock site database
export const mockSiteDatabase = {
  waitForDB: jest.fn(() => Promise.resolve(true))
};

// Mock ports service
export const mockPorts = {
  allocatePort: jest.fn(() => Promise.resolve(3000)),
  releasePort: jest.fn(() => Promise.resolve())
};

// Mock WP-CLI service
export const mockWpCli = {
  run: jest.fn(() => Promise.resolve({ stdout: '', stderr: '' }))
};

// Mock user data (persistent storage)
export const mockUserData = {
  get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
  set: jest.fn()
};

// Service container cradle
const mockServices = {
  localLogger: mockLocalLogger,
  siteData: mockSiteData,
  siteProcessManager: mockSiteProcessManager,
  siteDatabase: mockSiteDatabase,
  ports: mockPorts,
  wpCli: mockWpCli,
  userData: mockUserData
};

// Mock service container
export const getServiceContainer = jest.fn(() => ({
  cradle: mockServices
}));

// Helper to reset all mocks
export const resetAllMocks = () => {
  Object.values(mockLocalLogger).forEach(fn => fn.mockClear());
  Object.values(mockSiteData).forEach(fn => fn.mockClear());
  Object.values(mockSiteProcessManager).forEach(fn => fn.mockClear());
  Object.values(mockSiteDatabase).forEach(fn => fn.mockClear());
  Object.values(mockPorts).forEach(fn => fn.mockClear());
  Object.values(mockWpCli).forEach(fn => fn.mockClear());
  Object.values(mockUserData).forEach(fn => fn.mockClear());
  getServiceContainer.mockClear();
};

// Helper to get mock services for assertions
export const getMockServices = () => mockServices;

// Default export for module
export default {
  getServiceContainer,
  getMockServices,
  resetAllMocks
};
