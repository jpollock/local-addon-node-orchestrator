/**
 * WpCliManager - Manages WP-CLI command execution
 * Provides a secure interface for running WP-CLI commands on WordPress sites
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as Local from '@getflywheel/local';

export interface WpCliResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface PluginInfo {
  name: string;
  status: 'active' | 'inactive';
  update: 'available' | 'none';
  version: string;
  title?: string;
}

/**
 * WP-CLI Manager
 * Handles all WP-CLI operations with security validation
 */
export class WpCliManager {
  private wpCliPath: string | null = null;

  // Whitelist of allowed WP-CLI commands for security
  private readonly ALLOWED_COMMANDS = new Set([
    'plugin',
    'option',
    'user',
    'post',
    'db',
    'cache',
    'rewrite',
    'theme'
  ]);

  // Whitelist of allowed plugin subcommands
  private readonly ALLOWED_PLUGIN_SUBCOMMANDS = new Set([
    'list',
    'status',
    'activate',
    'deactivate',
    'delete',
    'get',
    'install',
    'is-installed',
    'path',
    'search',
    'toggle',
    'uninstall',
    'update'
  ]);

  constructor() {
    // WP-CLI path will be resolved dynamically
  }

  /**
   * Resolve WP-CLI binary path
   * Tries multiple common locations used by Local
   */
  private async resolveWpCliPath(): Promise<string | null> {
    // If already resolved, return cached path
    if (this.wpCliPath) {
      return this.wpCliPath;
    }

    // Common WP-CLI paths in Local
    const possiblePaths = [
      '/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp',
      '/Applications/Local.app/Contents/Resources/extraResources/lightning-services/php-7.4.1+8/bin/darwin/bin/wp',
      '/Applications/Local.app/Contents/Resources/extraResources/lightning-services/php-8.0.0+3/bin/darwin/bin/wp',
      '/Applications/Local.app/Contents/Resources/extraResources/lightning-services/php-8.1.0+2/bin/darwin/bin/wp',
      '/usr/local/bin/wp',
      '/opt/homebrew/bin/wp',
      'wp' // Try system PATH
    ];

    // Check each path
    for (const wpPath of possiblePaths) {
      try {
        // For simple 'wp', assume it exists if we're checking system PATH
        if (wpPath === 'wp') {
          this.wpCliPath = wpPath;
          return wpPath;
        }

        // Check if file exists and is executable
        if (await fs.pathExists(wpPath)) {
          const stats = await fs.stat(wpPath);
          if (stats.isFile()) {
            this.wpCliPath = wpPath;
            return wpPath;
          }
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    return null;
  }

  /**
   * Expand tilde (~) in file paths to home directory
   */
  private expandTilde(filePath: string): string {
    if (!filePath) return filePath;

    // If path starts with ~/, replace with home directory
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }

    // If path is just ~, return home directory
    if (filePath === '~') {
      return os.homedir();
    }

    // Otherwise return as-is (including if ~ appears in middle of path, which is unusual)
    return filePath;
  }

  /**
   * Validate command against whitelist
   */
  private validateCommand(command: string, args: string[]): { valid: boolean; error?: string } {
    // Check if main command is allowed
    if (!this.ALLOWED_COMMANDS.has(command)) {
      return {
        valid: false,
        error: `Command '${command}' is not allowed. Only whitelisted WP-CLI commands are permitted.`
      };
    }

    // Additional validation for plugin commands
    if (command === 'plugin' && args.length > 0) {
      const subcommand = args[0];
      if (!this.ALLOWED_PLUGIN_SUBCOMMANDS.has(subcommand)) {
        return {
          valid: false,
          error: `Plugin subcommand '${subcommand}' is not allowed.`
        };
      }
    }

    // Check for shell metacharacters in arguments
    const shellMetaChars = /[;&|`$()<>\\'"]/;
    for (const arg of args) {
      if (shellMetaChars.test(arg)) {
        return {
          valid: false,
          error: `Argument contains invalid characters: ${arg}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Execute a WP-CLI command
   *
   * @param site - The Local site object
   * @param command - The WP-CLI command (e.g., 'plugin')
   * @param args - Command arguments (e.g., ['list', '--format=json'])
   * @returns Promise resolving to command result
   */
  async execute(
    site: Local.Site,
    command: string,
    args: string[] = []
  ): Promise<WpCliResult> {
    try {
      // Resolve WP-CLI path
      const wpPath = await this.resolveWpCliPath();
      if (!wpPath) {
        return {
          success: false,
          error: 'WP-CLI binary not found. Please ensure WP-CLI is installed in Local.'
        };
      }

      // Validate command
      const validation = this.validateCommand(command, args);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Get WordPress installation path
      // Expand tilde and resolve to absolute path
      const sitePath = this.expandTilde(site.path);
      const wpPath_site = path.resolve(sitePath, 'app', 'public');

      // Verify WordPress installation exists
      if (!await fs.pathExists(wpPath_site)) {
        return {
          success: false,
          error: 'WordPress installation not found in site directory'
        };
      }

      // Build command arguments
      const fullArgs = [command, ...args, `--path=${wpPath_site}`];

      // Execute WP-CLI command
      return await this.spawnWpCliProcess(wpPath, fullArgs);

    } catch (error: any) {
      return {
        success: false,
        error: this.sanitizeError(error)
      };
    }
  }

  /**
   * Run a WP-CLI command string (convenience wrapper for execute)
   * Parses command string and delegates to execute method
   *
   * @param site - The Local site object
   * @param commandString - Full command string (e.g., "plugin install wp-graphql")
   * @returns Promise resolving to command result
   */
  async runCommand(site: Local.Site, commandString: string): Promise<WpCliResult> {
    // Parse command string into command and args
    const parts = commandString.trim().split(/\s+/);
    if (parts.length === 0) {
      return {
        success: false,
        error: 'Empty command string'
      };
    }

    const [command, ...args] = parts;
    return await this.execute(site, command, args);
  }

  /**
   * Spawn WP-CLI process and capture output
   */
  private spawnWpCliProcess(wpPath: string, args: string[]): Promise<WpCliResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // Spawn process with shell: false for security
      const proc = spawn(wpPath, args, {
        shell: false,
        stdio: 'pipe'
      });

      // Capture stdout
      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Capture stderr
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout.trim()
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || stdout.trim() || `WP-CLI command exited with code ${code}`
          });
        }
      });

      // Handle process errors
      proc.on('error', (error: Error) => {
        resolve({
          success: false,
          error: this.sanitizeError(error)
        });
      });

      // Set timeout (30 seconds)
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: 'WP-CLI command timed out after 30 seconds'
        });
      }, 30000);
    });
  }

  /**
   * List all plugins in a WordPress site
   */
  async listPlugins(site: Local.Site): Promise<PluginInfo[]> {
    try {
      const result = await this.execute(site, 'plugin', ['list', '--format=json']);

      if (!result.success || !result.output) {
        return [];
      }

      // Parse JSON output
      const plugins = JSON.parse(result.output);
      return plugins.map((plugin: any) => ({
        name: plugin.name,
        status: plugin.status,
        update: plugin.update,
        version: plugin.version,
        title: plugin.title
      }));

    } catch (error) {
      console.error('Failed to list plugins:', error);
      return [];
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(site: Local.Site, slug: string): Promise<WpCliResult> {
    // Validate plugin slug
    if (!this.isValidPluginSlug(slug)) {
      return {
        success: false,
        error: 'Invalid plugin slug format'
      };
    }

    return await this.execute(site, 'plugin', ['activate', slug]);
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(site: Local.Site, slug: string): Promise<WpCliResult> {
    // Validate plugin slug
    if (!this.isValidPluginSlug(slug)) {
      return {
        success: false,
        error: 'Invalid plugin slug format'
      };
    }

    return await this.execute(site, 'plugin', ['deactivate', slug]);
  }

  /**
   * Get plugin status
   */
  async getPluginStatus(site: Local.Site, slug: string): Promise<PluginInfo | null> {
    try {
      const result = await this.execute(site, 'plugin', ['get', slug, '--format=json']);

      if (!result.success || !result.output) {
        return null;
      }

      const plugin = JSON.parse(result.output);
      return {
        name: plugin.name,
        status: plugin.status,
        update: plugin.update,
        version: plugin.version,
        title: plugin.title
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Check if plugin is installed
   */
  async isPluginInstalled(site: Local.Site, slug: string): Promise<boolean> {
    const result = await this.execute(site, 'plugin', ['is-installed', slug]);
    return result.success;
  }

  /**
   * Delete a plugin (must be deactivated first)
   */
  async deletePlugin(site: Local.Site, slug: string): Promise<WpCliResult> {
    // Validate plugin slug
    if (!this.isValidPluginSlug(slug)) {
      return {
        success: false,
        error: 'Invalid plugin slug format'
      };
    }

    return await this.execute(site, 'plugin', ['delete', slug]);
  }

  /**
   * Validate plugin slug format
   * Plugin slugs should only contain alphanumeric characters, hyphens, and underscores
   */
  private isValidPluginSlug(slug: string): boolean {
    if (!slug || typeof slug !== 'string') {
      return false;
    }

    // Length check
    if (slug.length === 0 || slug.length > 200) {
      return false;
    }

    // Format check: alphanumeric, hyphens, underscores only
    const validSlugPattern = /^[a-z0-9_-]+$/i;
    return validSlugPattern.test(slug);
  }

  /**
   * Sanitize error messages
   */
  private sanitizeError(error: any): string {
    if (!error) {
      return 'Unknown WP-CLI error occurred';
    }

    let message = error.message || String(error);

    // Remove user paths
    message = message.replace(/\/Users\/[^/\s]+/g, '[USER]');
    message = message.replace(/\/home\/[^/\s]+/g, '[USER]');
    message = message.replace(/C:\\Users\\[^\\s]+/g, '[USER]');

    return message;
  }
}
