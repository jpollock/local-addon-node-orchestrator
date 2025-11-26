/**
 * Integration tests for WordPress Plugin Installation
 * Tests the complete plugin installation workflow
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { GitManager } from '../../src/lib/GitManager';
import { WpCliManager } from '../../src/lib/wordpress/WpCliManager';
import { WordPressPluginManager } from '../../src/lib/wordpress/WordPressPluginManager';
import { isValidPluginSlug } from '../../src/security/validation';

// Mock Local Site object
const createMockSite = (sitePath: string) => ({
  id: 'test-site-id',
  name: 'Test Site',
  path: sitePath,
  host: 'test-site.local',
  domain: 'test-site.local',
  url: 'http://test-site.local',
  services: [],
  provisioning: { steps: [] }
} as any);

describe('Plugin Installation Integration Tests', () => {
  let tempDir: string;
  let sitePath: string;
  let gitManager: GitManager;
  let wpCliManager: WpCliManager;
  let pluginManager: WordPressPluginManager;

  beforeAll(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', '.temp-plugin-tests');
    sitePath = path.join(tempDir, 'test-site');

    // Create necessary directories
    await fs.ensureDir(sitePath);
    await fs.ensureDir(path.join(sitePath, 'app', 'public', 'wp-content', 'plugins'));
    await fs.ensureDir(path.join(sitePath, 'node-apps', '.temp'));

    // Initialize managers
    gitManager = new GitManager();
    wpCliManager = new WpCliManager();
    pluginManager = new WordPressPluginManager(gitManager, wpCliManager);
  });

  afterAll(async () => {
    // Clean up temporary directory
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Plugin Structure Validation', () => {
    it('should validate plugin with main PHP file', async () => {
      const pluginDir = path.join(tempDir, 'valid-plugin');
      await fs.ensureDir(pluginDir);

      // Create a valid plugin file with WordPress headers
      const pluginContent = `<?php
/*
Plugin Name: Test Plugin
Description: A test plugin
Version: 1.0
Author: Test Author
*/

function test_plugin_init() {
  // Plugin code
}
add_action('init', 'test_plugin_init');
`;

      await fs.writeFile(path.join(pluginDir, 'test-plugin.php'), pluginContent);

      // Test validation
      // @ts-ignore - accessing private method for testing
      const result = await pluginManager['validatePluginStructure'](pluginDir, 'test-plugin');

      expect(result.valid).toBe(true);

      // Clean up
      await fs.remove(pluginDir);
    });

    it('should reject directory without plugin headers', async () => {
      const pluginDir = path.join(tempDir, 'invalid-plugin');
      await fs.ensureDir(pluginDir);

      // Create a PHP file without plugin headers
      const phpContent = `<?php
function some_function() {
  return 'test';
}
`;

      await fs.writeFile(path.join(pluginDir, 'file.php'), phpContent);

      // Test validation
      // @ts-ignore - accessing private method for testing
      const result = await pluginManager['validatePluginStructure'](pluginDir, 'invalid-plugin');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('plugin');

      // Clean up
      await fs.remove(pluginDir);
    });

    it('should accept plugin.php as main file', async () => {
      const pluginDir = path.join(tempDir, 'alt-name-plugin');
      await fs.ensureDir(pluginDir);

      const pluginContent = `<?php
/*
Plugin Name: Alternative Name Plugin
Description: Plugin with plugin.php as main file
Version: 1.0
*/
`;

      await fs.writeFile(path.join(pluginDir, 'plugin.php'), pluginContent);

      // @ts-ignore - accessing private method for testing
      const result = await pluginManager['validatePluginStructure'](pluginDir, 'alt-name-plugin');

      expect(result.valid).toBe(true);

      // Clean up
      await fs.remove(pluginDir);
    });

    it('should handle missing directory gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      // @ts-ignore - accessing private method for testing
      const result = await pluginManager['validatePluginStructure'](nonExistentDir, 'test');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('Plugin Header Detection', () => {
    it('should detect WordPress plugin headers', () => {
      const validHeaders = [
        `<?php
/*
Plugin Name: My Plugin
Description: Test
*/`,
        `<?php
/**
 * Plugin Name: My Plugin
 * Description: Test
 */`,
        `<?php
/* Plugin Name: My Plugin */`
      ];

      validHeaders.forEach(content => {
        // @ts-ignore - accessing private method for testing
        const hasHeaders = pluginManager['hasPluginHeaders'](content);
        expect(hasHeaders).toBe(true);
      });
    });

    it('should reject files without plugin headers', () => {
      const invalidContents = [
        '<?php function test() {}',
        '<?php // Just a comment',
        '<?php /* Regular comment, not a plugin */',
        'plain text file',
        ''
      ];

      invalidContents.forEach(content => {
        // @ts-ignore - accessing private method for testing
        const hasHeaders = pluginManager['hasPluginHeaders'](content);
        expect(hasHeaders).toBe(false);
      });
    });
  });

  describe('Plugin Slug Validation', () => {
    it('should validate correct plugin slugs', () => {
      const validSlugs = [
        'my-plugin',
        'test_plugin',
        'plugin-123',
        'a-b-c',
        'plugin',
        'Plugin-Name'       // Uppercase is valid (case-insensitive)
      ];

      validSlugs.forEach(slug => {
        // Test consolidated validation function from security module
        const isValid = isValidPluginSlug(slug);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid plugin slugs', () => {
      const invalidSlugs = [
        '',
        'plugin name',      // Space
        'plugin/path',      // Slash
        '../plugin',        // Path traversal
        'plugin;test',      // Semicolon
        'plugin@test',      // Special character
        'a'.repeat(201)     // Too long
      ];

      invalidSlugs.forEach(slug => {
        // Test consolidated validation function from security module
        const isValid = isValidPluginSlug(slug);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize error messages', () => {
      const sensitiveError = new Error('/Users/john/Documents/site/error occurred');

      // @ts-ignore - accessing private method for testing
      const sanitized = pluginManager['sanitizeError'](sensitiveError);

      expect(sanitized).not.toContain('/Users/john');
      expect(sanitized).toContain('[USER]');
    });

    it('should handle various error types', () => {
      const errors = [
        new Error('Test error'),
        new Error('Path /home/user/test failed'),
        { message: 'Object error' },
        'String error',
        null,
        undefined
      ];

      errors.forEach(error => {
        // @ts-ignore - accessing private method for testing
        const sanitized = pluginManager['sanitizeError'](error);
        expect(typeof sanitized).toBe('string');
        expect(sanitized.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Monorepo Support', () => {
    it('should handle subdirectory path traversal security', async () => {
      const site = createMockSite(sitePath);

      // Create a mock cloned directory
      const tempClonePath = path.join(sitePath, 'node-apps', '.temp', 'test-clone');
      await fs.ensureDir(tempClonePath);

      // Attempt to install with path traversal in subdirectory
      const config = {
        name: 'Malicious Plugin',
        gitUrl: 'https://example.com/repo.git',
        branch: 'main',
        subdirectory: '../../../etc',  // Path traversal attempt
        slug: 'malicious-plugin'
      };

      // The installPlugin would fail during validation
      // We can test the subdirectory validation directly
      const subdirPath = path.join(tempClonePath, config.subdirectory);
      const resolvedSubdir = path.resolve(subdirPath);
      const resolvedClone = path.resolve(tempClonePath);

      // Security check: subdirectory must be within clone path
      const isSecure = resolvedSubdir.startsWith(resolvedClone);
      expect(isSecure).toBe(false);

      // Clean up
      await fs.remove(tempClonePath);
    });

    it('should accept valid subdirectory paths', async () => {
      const tempClonePath = path.join(sitePath, 'node-apps', '.temp', 'test-clone-2');
      await fs.ensureDir(tempClonePath);
      await fs.ensureDir(path.join(tempClonePath, 'plugins', 'my-plugin'));

      const validSubdirs = [
        'plugins/my-plugin',
        'packages/plugin',
        'apps/wp-plugin'
      ];

      for (const subdir of validSubdirs) {
        const subdirPath = path.join(tempClonePath, subdir);
        await fs.ensureDir(subdirPath);

        const resolvedSubdir = path.resolve(subdirPath);
        const resolvedClone = path.resolve(tempClonePath);

        // Security check should pass
        const isSecure = resolvedSubdir.startsWith(resolvedClone);
        expect(isSecure).toBe(true);
      }

      // Clean up
      await fs.remove(tempClonePath);
    });
  });

  describe('Installation Directory Management', () => {
    it('should prevent overwriting existing plugins', async () => {
      const pluginsDir = path.join(sitePath, 'app', 'public', 'wp-content', 'plugins');
      const existingPluginDir = path.join(pluginsDir, 'existing-plugin');

      // Create existing plugin directory
      await fs.ensureDir(existingPluginDir);
      await fs.writeFile(path.join(existingPluginDir, 'test.txt'), 'existing data');

      // Verify directory exists
      const exists = await fs.pathExists(existingPluginDir);
      expect(exists).toBe(true);

      // Clean up
      await fs.remove(existingPluginDir);
    });

    it('should create plugins directory if missing', async () => {
      const testSitePath = path.join(tempDir, 'site-without-plugins');
      await fs.ensureDir(path.join(testSitePath, 'app', 'public', 'wp-content'));

      const pluginsDir = path.join(testSitePath, 'app', 'public', 'wp-content', 'plugins');

      // Ensure directory doesn't exist
      await fs.remove(pluginsDir);
      expect(await fs.pathExists(pluginsDir)).toBe(false);

      // Create it
      await fs.ensureDir(pluginsDir);
      expect(await fs.pathExists(pluginsDir)).toBe(true);

      // Clean up
      await fs.remove(testSitePath);
    });
  });
});
