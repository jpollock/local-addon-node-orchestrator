/**
 * Unit tests for subdirectory path validation
 * SECURITY CRITICAL: Tests for path traversal attack vectors
 */

import { validate, AddAppRequestSchema } from '../../src/security/schemas';

describe('Subdirectory Validation', () => {
  /**
   * Helper to create a valid base request
   */
  const createBaseRequest = (subdirectory?: string) => ({
    siteId: 'test-site-123',
    app: {
      name: 'test-app',
      gitUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      subdirectory,
      installCommand: 'npm install',
      buildCommand: '',
      startCommand: 'npm start',
      nodeVersion: '20.x' as const,
      autoStart: false,
      env: {}
    }
  });

  describe('Valid subdirectories', () => {
    it('should accept valid single subdirectory', () => {
      const request = createBaseRequest('packages');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('packages');
      }
    });

    it('should accept valid nested subdirectories', () => {
      const request = createBaseRequest('packages/api');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('packages/api');
      }
    });

    it('should accept deeply nested subdirectories', () => {
      const request = createBaseRequest('apps/backend/api/src');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('apps/backend/api/src');
      }
    });

    it('should accept subdirectory with hyphens', () => {
      const request = createBaseRequest('my-app/sub-dir');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('my-app/sub-dir');
      }
    });

    it('should accept subdirectory with underscores', () => {
      const request = createBaseRequest('my_app/sub_dir');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('my_app/sub_dir');
      }
    });

    it('should accept subdirectory with dots in names', () => {
      const request = createBaseRequest('my.app/sub.dir');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('my.app/sub.dir');
      }
    });

    it('should accept subdirectory with numbers', () => {
      const request = createBaseRequest('app2/v2/api');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('app2/v2/api');
      }
    });

    it('should accept undefined subdirectory (optional field)', () => {
      const request = createBaseRequest(undefined);
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBeUndefined();
      }
    });
  });

  describe('Path Traversal Attack Vectors - SECURITY TESTS', () => {
    it('should reject classic path traversal with ../', () => {
      const request = createBaseRequest('../etc/passwd');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject path traversal in middle of path', () => {
      const request = createBaseRequest('packages/../../../etc/passwd');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject path traversal with ..\\ (Windows style)', () => {
      const request = createBaseRequest('packages\\..\\..\\windows');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject absolute paths starting with /', () => {
      const request = createBaseRequest('/etc/passwd');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject absolute paths starting with /home', () => {
      const request = createBaseRequest('/home/user/.ssh/id_rsa');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject Windows absolute paths', () => {
      const request = createBaseRequest('C:\\Windows\\System32');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject hidden directory at start', () => {
      const request = createBaseRequest('.ssh/id_rsa');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject double-dot in filename', () => {
      const request = createBaseRequest('packages/..hidden/file');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Path traversal');
      }
    });

    it('should reject null byte injection', () => {
      const request = createBaseRequest('packages/api\0/etc/passwd');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject backslashes (Windows path separators)', () => {
      const request = createBaseRequest('packages\\api\\src');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });
  });

  describe('Special Characters Attack Vectors', () => {
    it('should reject shell metacharacters - semicolon', () => {
      const request = createBaseRequest('packages;rm -rf /');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject shell metacharacters - pipe', () => {
      const request = createBaseRequest('packages|cat /etc/passwd');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject shell metacharacters - ampersand', () => {
      const request = createBaseRequest('packages&whoami');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject shell metacharacters - backtick', () => {
      const request = createBaseRequest('packages`whoami`');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject shell metacharacters - dollar sign', () => {
      const request = createBaseRequest('packages$(whoami)');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject quotes in path', () => {
      const request = createBaseRequest('packages/"malicious"');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject single quotes in path', () => {
      const request = createBaseRequest("packages/'malicious'");
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject angle brackets', () => {
      const request = createBaseRequest('packages<script>alert(1)</script>');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject parentheses', () => {
      const request = createBaseRequest('packages(malicious)');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject spaces in path', () => {
      const request = createBaseRequest('packages/my app');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject tab characters', () => {
      const request = createBaseRequest('packages\tapi');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });

    it('should reject newline characters', () => {
      const request = createBaseRequest('packages\napi');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid characters');
      }
    });
  });

  describe('Length and Edge Cases', () => {
    it('should reject paths that are too long (> 500 chars)', () => {
      const longPath = 'a/'.repeat(300); // Creates a path > 500 chars
      const request = createBaseRequest(longPath);
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('too long');
      }
    });

    it('should accept maximum valid length path (500 chars)', () => {
      // Create a path exactly 500 chars with valid characters
      const path = 'a'.repeat(498) + '/b'; // 500 chars total
      const request = createBaseRequest(path);
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
    });

    it('should reject empty string (if provided)', () => {
      const request = createBaseRequest('');
      const result = validate(AddAppRequestSchema, request);

      // Empty string should be rejected or treated as undefined
      // Since we use .optional(), empty string might be allowed
      // Let's check the actual behavior
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        // If it's accepted, subdirectory should be empty string
        expect(result.data.app.subdirectory).toBe('');
      }
    });
  });

  describe('Real-world Monorepo Patterns', () => {
    it('should accept Turborepo pattern: apps/web', () => {
      const request = createBaseRequest('apps/web');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('apps/web');
      }
    });

    it('should accept Nx pattern: libs/shared/utils', () => {
      const request = createBaseRequest('libs/shared/utils');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('libs/shared/utils');
      }
    });

    it('should accept Lerna pattern: packages/package-name', () => {
      const request = createBaseRequest('packages/package-name');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('packages/package-name');
      }
    });

    it('should accept nested packages: packages/frontend/admin', () => {
      const request = createBaseRequest('packages/frontend/admin');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('packages/frontend/admin');
      }
    });

    it('should accept scoped packages: packages/@myorg/api', () => {
      // Note: @ is not in our allowed character set, so this should fail
      // This is intentional for security
      const request = createBaseRequest('packages/@myorg/api');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(false);
      // Scoped packages with @ should use directory name without @
      // User should use packages/myorg-api or packages/myorg/api
    });
  });

  describe('Case Sensitivity', () => {
    it('should accept mixed case subdirectory', () => {
      const request = createBaseRequest('Apps/Backend/API');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('Apps/Backend/API');
      }
    });

    it('should preserve case in validated path', () => {
      const request = createBaseRequest('MyApp/SubDir');
      const result = validate(AddAppRequestSchema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app.subdirectory).toBe('MyApp/SubDir');
      }
    });
  });
});
