/**
 * Unit tests for WpCliManager
 * Tests command validation, security, and WP-CLI operations
 */

import { WpCliManager } from '../../src/lib/wordpress/WpCliManager';
import { isValidPluginSlug } from '../../src/security/validation';

describe('WpCliManager', () => {
  let wpCliManager: WpCliManager;
  let mockWpCli: any;

  beforeEach(() => {
    mockWpCli = {
      run: jest.fn()
    };
    wpCliManager = new WpCliManager(mockWpCli);
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
          // Use 'list' as valid subcommand, then add dangerous arg
          const result = wpCliManager['validateCommand']('plugin', ['list', `test${char}value`]);
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

      it('should allow valid option flags', () => {
        const validFlags = ['--format=json', '--status=active', '--field=name', '--skip-plugins', '--allow-root'];

        validFlags.forEach(flag => {
          // @ts-ignore - accessing private method for testing
          const result = wpCliManager['validateCommand']('plugin', ['list', flag]);
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  describe('Plugin Slug Validation', () => {
    it('should accept valid plugin slugs', () => {
      const validSlugs = [
        'my-plugin',
        'plugin123',
        'a',
        'plugin-name-here',
        'plugin_name',
        'PLUGIN'
      ];

      validSlugs.forEach(slug => {
        // Test consolidated validation function from security module
        const result = isValidPluginSlug(slug);
        expect(result).toBe(true);
      });
    });

    it('should reject invalid plugin slugs', () => {
      const invalidSlugs = [
        '',                    // empty
        '../path',             // path traversal
        'plugin/name',         // forward slash
        'plugin\\name',        // backslash
        'plugin name',         // space
        'plugin;name',         // semicolon
        'plugin|name',         // pipe
      ];

      invalidSlugs.forEach(slug => {
        // Test consolidated validation function from security module
        const result = isValidPluginSlug(slug);
        expect(result).toBe(false);
      });
    });
  });

  describe('Execute Command', () => {
    const mockSite = {
      id: 'test-site',
      path: '/path/to/site',
      name: 'Test Site'
    } as any;

    it('should execute valid commands', async () => {
      mockWpCli.run.mockResolvedValue({ stdout: 'success', stderr: '' });

      const result = await wpCliManager.execute(mockSite, 'plugin', ['list']);

      expect(result.success).toBe(true);
      expect(result.output).toBe('success');
      expect(mockWpCli.run).toHaveBeenCalledWith(mockSite, ['plugin', 'list']);
    });

    it('should reject invalid commands', async () => {
      const result = await wpCliManager.execute(mockSite, 'eval', ['code']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
      expect(mockWpCli.run).not.toHaveBeenCalled();
    });

    it('should handle WP-CLI errors', async () => {
      mockWpCli.run.mockRejectedValue({ stderr: 'WP-CLI error' });

      const result = await wpCliManager.execute(mockSite, 'plugin', ['list']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('WP-CLI error');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle null command safely', () => {
      // @ts-ignore - testing invalid inputs
      const result = wpCliManager['validateCommand'](null, []);
      expect(result.valid).toBe(false);
    });

    it('should handle undefined command safely', () => {
      // @ts-ignore - testing invalid inputs
      const result = wpCliManager['validateCommand'](undefined, []);
      expect(result.valid).toBe(false);
    });

    it('should handle null slug safely', () => {
      // @ts-ignore - testing invalid inputs
      expect(isValidPluginSlug(null)).toBe(false);
    });

    it('should handle undefined slug safely', () => {
      // @ts-ignore - testing invalid inputs
      expect(isValidPluginSlug(undefined)).toBe(false);
    });

    it('should handle very long inputs safely', () => {
      const longString = 'a'.repeat(10000);

      // Should not crash - testing consolidated validation function
      const result = isValidPluginSlug(longString);
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
        const result = wpCliManager['validateCommand']('plugin', ['list', arg]);
        // Null bytes should be caught as invalid characters
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Plugin Operations', () => {
    const mockSite = {
      id: 'test-site',
      path: '/path/to/site',
      name: 'Test Site'
    } as any;

    it('should activate a plugin', async () => {
      mockWpCli.run.mockResolvedValue({ stdout: 'Plugin activated.', stderr: '' });

      const result = await wpCliManager.activatePlugin(mockSite, 'my-plugin');

      expect(result.success).toBe(true);
      expect(mockWpCli.run).toHaveBeenCalledWith(mockSite, ['plugin', 'activate', 'my-plugin']);
    });

    it('should deactivate a plugin', async () => {
      mockWpCli.run.mockResolvedValue({ stdout: 'Plugin deactivated.', stderr: '' });

      const result = await wpCliManager.deactivatePlugin(mockSite, 'my-plugin');

      expect(result.success).toBe(true);
      expect(mockWpCli.run).toHaveBeenCalledWith(mockSite, ['plugin', 'deactivate', 'my-plugin']);
    });

    it('should delete a plugin', async () => {
      mockWpCli.run.mockResolvedValue({ stdout: 'Plugin deleted.', stderr: '' });

      const result = await wpCliManager.deletePlugin(mockSite, 'my-plugin');

      expect(result.success).toBe(true);
      expect(mockWpCli.run).toHaveBeenCalledWith(mockSite, ['plugin', 'delete', 'my-plugin']);
    });

    it('should get plugin status', async () => {
      // getPluginStatus uses 'plugin get' which returns a single object, not an array
      mockWpCli.run.mockResolvedValue({
        stdout: JSON.stringify({ name: 'my-plugin', status: 'active', version: '1.0.0' }),
        stderr: ''
      });

      const result = await wpCliManager.getPluginStatus(mockSite, 'my-plugin');

      expect(result).toBeDefined();
      expect(result?.status).toBe('active');
    });

    it('should reject invalid plugin slugs', async () => {
      const result = await wpCliManager.activatePlugin(mockSite, '../malicious');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin slug');
    });
  });
});
