/**
 * Unit tests for WordPressEnvManager
 *
 * Tests WordPress environment variable extraction from Local sites
 * Includes security tests for credential sanitization
 */

import { WordPressEnvManager } from '../../src/lib/wordpress/WordPressEnvManager';
import * as Local from '@getflywheel/local';

describe('WordPressEnvManager', () => {
  // Mock Local.Site object with typical structure
  const mockSite: Partial<Local.Site> = {
    id: 'test-site-id',
    name: 'Test WordPress Site',
    domain: 'test-site.local',
    path: '/Users/test/Local Sites/test-site',
    paths: {
      webRoot: '/Users/test/Local Sites/test-site/app/public'
    } as any,
    mysql: {
      database: 'local',
      user: 'root',
      password: 'root',
      host: 'localhost',
      port: 3306
    } as any
  };

  describe('extractWordPressEnv', () => {
    it('should extract all WordPress environment variables from a valid site', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);

      expect(wpEnv.WP_DB_HOST).toBe('localhost');
      expect(wpEnv.WP_DB_NAME).toBe('local');
      expect(wpEnv.WP_DB_USER).toBe('root');
      expect(wpEnv.WP_DB_PASSWORD).toBe('root');
      expect(wpEnv.WP_SITE_URL).toBe('http://test-site.local');
      expect(wpEnv.WP_HOME_URL).toBe('http://test-site.local');
      expect(wpEnv.WP_ADMIN_URL).toBe('http://test-site.local/wp-admin');
      expect(wpEnv.WP_CONTENT_DIR).toBe('/Users/test/Local Sites/test-site/app/public/wp-content');
      expect(wpEnv.WP_UPLOADS_DIR).toBe('/Users/test/Local Sites/test-site/app/public/wp-content/uploads');
    });

    it('should include DATABASE_URL with properly encoded credentials', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);

      expect(wpEnv.DATABASE_URL).toBeDefined();
      expect(wpEnv.DATABASE_URL).toBe('mysql://root:root@localhost/local');
    });

    it('should handle custom MySQL port in host', () => {
      const siteWithPort: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: 'root',
          host: 'localhost',
          port: 10006
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithPort as Local.Site);

      expect(wpEnv.WP_DB_HOST).toBe('localhost:10006');
      expect(wpEnv.DATABASE_URL).toBe('mysql://root:root@localhost:10006/local');
    });

    it('should handle passwords with special characters', () => {
      const siteWithSpecialPassword: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: 'p@ss:w/rd!#$',
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithSpecialPassword as Local.Site);

      expect(wpEnv.WP_DB_PASSWORD).toBe('p@ss:w/rd!#$');
      // URL-encoded password in DATABASE_URL
      expect(wpEnv.DATABASE_URL).toContain('p%40ss%3Aw%2Frd!%23%24');
    });

    it('should handle domains with http:// prefix', () => {
      const siteWithHttpDomain: Partial<Local.Site> = {
        ...mockSite,
        domain: 'http://prefixed-site.local'
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithHttpDomain as Local.Site);

      expect(wpEnv.WP_SITE_URL).toBe('http://prefixed-site.local');
    });

    it('should handle domains with https:// prefix', () => {
      const siteWithHttpsDomain: Partial<Local.Site> = {
        ...mockSite,
        domain: 'https://secure-site.local'
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithHttpsDomain as Local.Site);

      expect(wpEnv.WP_SITE_URL).toBe('https://secure-site.local');
    });

    it('should throw error if database name is missing', () => {
      const siteWithoutDbName: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: '',
          user: 'root',
          password: 'root',
          host: 'localhost',
          port: 3306
        } as any
      };

      expect(() => {
        WordPressEnvManager.extractWordPressEnv(siteWithoutDbName as Local.Site);
      }).toThrow('Unable to extract database name');
    });

    it('should throw error if site URL/domain is missing', () => {
      const siteWithoutDomain: Partial<Local.Site> = {
        ...mockSite,
        domain: undefined
      };

      expect(() => {
        WordPressEnvManager.extractWordPressEnv(siteWithoutDomain as Local.Site);
      }).toThrow('Unable to extract site URL');
    });

    it('should throw error if web root is missing', () => {
      const siteWithoutWebRoot: Partial<Local.Site> = {
        ...mockSite,
        paths: {} as any,
        path: undefined
      };

      expect(() => {
        WordPressEnvManager.extractWordPressEnv(siteWithoutWebRoot as Local.Site);
      }).toThrow('Unable to extract web root');
    });

    it('should use alternative mysql field locations', () => {
      // Test when mysql is under services.mysql instead of root
      const siteWithServicesMysql: any = {
        ...mockSite,
        mysql: undefined,
        services: {
          mysql: {
            database: 'test_db',
            user: 'test_user',
            password: 'test_pass',
            host: '127.0.0.1',
            port: 3306
          }
        }
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithServicesMysql);

      expect(wpEnv.WP_DB_NAME).toBe('test_db');
      expect(wpEnv.WP_DB_USER).toBe('test_user');
      expect(wpEnv.WP_DB_PASSWORD).toBe('test_pass');
      expect(wpEnv.WP_DB_HOST).toBe('127.0.0.1');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact database password', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      expect(sanitized.WP_DB_PASSWORD).toBe('***REDACTED***');
      expect(sanitized.WP_DB_PASSWORD).not.toBe(wpEnv.WP_DB_PASSWORD);
    });

    it('should redact DATABASE_URL', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      expect(sanitized.DATABASE_URL).toBe('mysql://***REDACTED***');
      expect(sanitized.DATABASE_URL).not.toContain('root');
    });

    it('should preserve non-sensitive fields', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      expect(sanitized.WP_DB_HOST).toBe(wpEnv.WP_DB_HOST);
      expect(sanitized.WP_DB_NAME).toBe(wpEnv.WP_DB_NAME);
      expect(sanitized.WP_DB_USER).toBe(wpEnv.WP_DB_USER);
      expect(sanitized.WP_SITE_URL).toBe(wpEnv.WP_SITE_URL);
      expect(sanitized.WP_HOME_URL).toBe(wpEnv.WP_HOME_URL);
      expect(sanitized.WP_ADMIN_URL).toBe(wpEnv.WP_ADMIN_URL);
      expect(sanitized.WP_CONTENT_DIR).toBe(wpEnv.WP_CONTENT_DIR);
      expect(sanitized.WP_UPLOADS_DIR).toBe(wpEnv.WP_UPLOADS_DIR);
    });

    it('should handle undefined DATABASE_URL', () => {
      const wpEnv = WordPressEnvManager.extractWordPressEnv(mockSite as Local.Site);
      wpEnv.DATABASE_URL = undefined;
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      expect(sanitized.DATABASE_URL).toBeUndefined();
    });
  });

  describe('canExtractWordPressEnv', () => {
    it('should return true for valid site', () => {
      const canExtract = WordPressEnvManager.canExtractWordPressEnv(mockSite as Local.Site);

      expect(canExtract).toBe(true);
    });

    it('should return false for site with missing database', () => {
      const invalidSite: Partial<Local.Site> = {
        ...mockSite,
        mysql: undefined
      };

      const canExtract = WordPressEnvManager.canExtractWordPressEnv(invalidSite as Local.Site);

      expect(canExtract).toBe(false);
    });

    it('should return false for site with missing domain', () => {
      const invalidSite: Partial<Local.Site> = {
        ...mockSite,
        domain: undefined
      };

      const canExtract = WordPressEnvManager.canExtractWordPressEnv(invalidSite as Local.Site);

      expect(canExtract).toBe(false);
    });

    it('should return false for null site', () => {
      const canExtract = WordPressEnvManager.canExtractWordPressEnv(null as any);

      expect(canExtract).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should never log actual password in sanitized output', () => {
      const sensitivePassword = 'super-secret-password-123!@#';
      const siteWithSensitivePassword: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: sensitivePassword,
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithSensitivePassword as Local.Site);
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      // Convert to string to check if password appears anywhere
      const sanitizedStr = JSON.stringify(sanitized);

      expect(sanitizedStr).not.toContain(sensitivePassword);
      expect(sanitized.WP_DB_PASSWORD).toBe('***REDACTED***');
    });

    it('should never log actual password in DATABASE_URL', () => {
      const sensitivePassword = 'another-secret-123!';
      const siteWithSensitivePassword: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: sensitivePassword,
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithSensitivePassword as Local.Site);
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);

      expect(sanitized.DATABASE_URL).not.toContain(sensitivePassword);
      expect(sanitized.DATABASE_URL).toBe('mysql://***REDACTED***');
    });

    it('should handle SQL injection attempts in database fields', () => {
      const maliciousSite: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: "local'; DROP TABLE users; --",
          user: "root' OR '1'='1",
          password: "pass'; DELETE FROM wp_posts; --",
          host: 'localhost',
          port: 3306
        } as any
      };

      // Should extract without errors (values will be used as env vars, not SQL)
      const wpEnv = WordPressEnvManager.extractWordPressEnv(maliciousSite as Local.Site);

      expect(wpEnv.WP_DB_NAME).toBe("local'; DROP TABLE users; --");
      expect(wpEnv.WP_DB_USER).toBe("root' OR '1'='1");
      expect(wpEnv.WP_DB_PASSWORD).toBe("pass'; DELETE FROM wp_posts; --");

      // Sanitized version should not leak these values
      const sanitized = WordPressEnvManager.sanitizeForLogging(wpEnv);
      expect(sanitized.WP_DB_PASSWORD).toBe('***REDACTED***');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string password', () => {
      const siteWithEmptyPassword: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: '',
          host: 'localhost',
          port: 3306
        } as any
      };

      expect(() => {
        WordPressEnvManager.extractWordPressEnv(siteWithEmptyPassword as Local.Site);
      }).toThrow('Unable to extract database password');
    });

    it('should handle very long database names', () => {
      const longDbName = 'a'.repeat(1000);
      const siteWithLongDbName: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: longDbName,
          user: 'root',
          password: 'root',
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithLongDbName as Local.Site);

      expect(wpEnv.WP_DB_NAME).toBe(longDbName);
    });

    it('should handle unicode characters in password', () => {
      const unicodePassword = 'pässwörd🔐中文';
      const siteWithUnicodePassword: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: unicodePassword,
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithUnicodePassword as Local.Site);

      expect(wpEnv.WP_DB_PASSWORD).toBe(unicodePassword);
      // Should be properly URL-encoded in DATABASE_URL
      expect(wpEnv.DATABASE_URL).toContain(encodeURIComponent(unicodePassword));
    });

    it('should handle standard port 3306 without appending to host', () => {
      const siteWithStandardPort: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: 'root',
          host: 'localhost',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithStandardPort as Local.Site);

      expect(wpEnv.WP_DB_HOST).toBe('localhost');
      expect(wpEnv.WP_DB_HOST).not.toContain(':3306');
    });

    it('should handle IPv6 addresses', () => {
      const siteWithIPv6: Partial<Local.Site> = {
        ...mockSite,
        mysql: {
          database: 'local',
          user: 'root',
          password: 'root',
          host: '::1',
          port: 3306
        } as any
      };

      const wpEnv = WordPressEnvManager.extractWordPressEnv(siteWithIPv6 as Local.Site);

      expect(wpEnv.WP_DB_HOST).toBe('::1');
    });
  });
});
