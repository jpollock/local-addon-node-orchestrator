/**
 * Mock for @getflywheel/local
 * Provides mock types and interfaces
 */

// Mock Site interface
export interface Site {
  id: string;
  name: string;
  path: string;
  domain: string;
  mysql?: {
    database: string;
    user: string;
    password: string;
  };
  environment?: string;
}

// Mock site factory for tests
export const createMockSite = (overrides: Partial<Site> = {}): Site => ({
  id: 'test-site-id',
  name: 'Test Site',
  path: '/Users/test/Local Sites/test-site',
  domain: 'test-site.local',
  mysql: {
    database: 'local',
    user: 'root',
    password: 'root'
  },
  environment: 'development',
  ...overrides
});

export default {
  Site: {} as Site,
  createMockSite
};
