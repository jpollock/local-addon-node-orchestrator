/**
 * WpCliManager - Manages WP-CLI command execution using Local's built-in wpCli service
 * Provides a secure interface for running WP-CLI commands on WordPress sites
 */

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
 * Uses Local's built-in wpCli service for all operations
 */
export class WpCliManager {
  private wpCli: any;  // Local's wpCli service from service container

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

  constructor(wpCli: any) {
    this.wpCli = wpCli;
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
   * Execute a WP-CLI command using Local's wpCli service
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
      // Validate command
      const validation = this.validateCommand(command, args);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Build full command arguments array
      const fullArgs = [command, ...args];

      // Execute using Local's wpCli service
      const result = await this.wpCli.run(site, fullArgs);

      return {
        success: true,
        output: result.stdout || ''
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.stderr || error.message || 'WP-CLI command failed'
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
}
