/**
 * WordPressPluginManager - Manages WordPress plugin installation and lifecycle
 * Handles Git-based plugin installation with monorepo support
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as Local from '@getflywheel/local';
import { v4 as uuidv4 } from 'uuid';
import { GitManager, GitCloneOptions } from '../GitManager';
import { WpCliManager, WpCliResult } from './WpCliManager';

export interface WordPressPlugin {
  id: string;
  name: string;
  gitUrl: string;
  branch: string;
  subdirectory?: string;  // For monorepo plugins
  slug: string;           // Directory name in wp-content/plugins
  status: 'installing' | 'installed' | 'active' | 'inactive' | 'error';
  installedPath: string;
  version?: string;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface InstallPluginConfig {
  name: string;
  gitUrl: string;
  branch: string;
  subdirectory?: string;
  slug: string;
  autoActivate?: boolean;
}

export interface PluginInstallProgress {
  phase: 'cloning' | 'copying' | 'validating' | 'activating' | 'complete';
  progress: number;
  message: string;
}

/**
 * WordPress Plugin Manager
 * Handles all plugin operations including installation, activation, and removal
 */
export class WordPressPluginManager {
  private gitManager: GitManager;
  private wpCliManager: WpCliManager;

  constructor(gitManager: GitManager, wpCliManager: WpCliManager) {
    this.gitManager = gitManager;
    this.wpCliManager = wpCliManager;
  }

  /**
   * Install a WordPress plugin from a Git repository
   *
   * @param site - The Local site object
   * @param config - Plugin installation configuration
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to installed plugin
   */
  async installPlugin(
    site: Local.Site,
    config: InstallPluginConfig,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const pluginId = uuidv4();
    let tempClonePath: string | null = null;

    try {
      // Validate plugin slug
      if (!this.isValidPluginSlug(config.slug)) {
        throw new Error('Invalid plugin slug. Must contain only lowercase letters, numbers, hyphens, and underscores.');
      }

      // Get WordPress plugins directory
      const pluginsDir = path.join(site.path, 'app', 'public', 'wp-content', 'plugins');
      const pluginInstallPath = path.join(pluginsDir, config.slug);

      // Check if plugin already exists
      if (await fs.pathExists(pluginInstallPath)) {
        throw new Error(`Plugin directory already exists: ${config.slug}`);
      }

      // Ensure plugins directory exists
      await fs.ensureDir(pluginsDir);

      // Step 1: Clone repository to temporary directory
      if (onProgress) {
        onProgress({
          phase: 'cloning',
          progress: 0,
          message: 'Cloning plugin repository...'
        });
      }

      // Create temporary directory for cloning
      const tempDir = path.join(site.path, 'node-apps', '.temp');
      await fs.ensureDir(tempDir);
      tempClonePath = path.join(tempDir, `plugin-${pluginId}`);

      // Clone the repository
      const cloneResult = await this.gitManager.cloneRepository({
        url: config.gitUrl,
        branch: config.branch,
        targetPath: tempClonePath
      });

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone plugin repository');
      }

      // Step 2: Determine source directory (handle monorepo subdirectory)
      let sourceDir = tempClonePath;
      if (config.subdirectory) {
        sourceDir = path.join(tempClonePath, config.subdirectory);

        // Validate subdirectory exists
        if (!await fs.pathExists(sourceDir)) {
          throw new Error(`Subdirectory not found in repository: ${config.subdirectory}`);
        }

        // Security: Ensure subdirectory is within cloned repo
        const resolvedSourceDir = path.resolve(sourceDir);
        const resolvedClonePath = path.resolve(tempClonePath);
        if (!resolvedSourceDir.startsWith(resolvedClonePath)) {
          throw new Error('Path traversal detected in subdirectory');
        }
      }

      // Step 3: Validate plugin structure
      if (onProgress) {
        onProgress({
          phase: 'validating',
          progress: 40,
          message: 'Validating plugin structure...'
        });
      }

      const validationResult = await this.validatePluginStructure(sourceDir, config.slug);
      if (!validationResult.valid) {
        throw new Error(validationResult.error || 'Invalid plugin structure');
      }

      // Step 4: Copy plugin files to wp-content/plugins
      if (onProgress) {
        onProgress({
          phase: 'copying',
          progress: 60,
          message: 'Installing plugin files...'
        });
      }

      await fs.copy(sourceDir, pluginInstallPath, {
        overwrite: false,
        errorOnExist: true
      });

      // Step 5: Activate plugin if requested
      let finalStatus: WordPressPlugin['status'] = 'installed';
      if (config.autoActivate) {
        if (onProgress) {
          onProgress({
            phase: 'activating',
            progress: 80,
            message: 'Activating plugin...'
          });
        }

        const activateResult = await this.wpCliManager.activatePlugin(site, config.slug);
        if (activateResult.success) {
          finalStatus = 'active';
        } else {
          console.warn(`Plugin installed but activation failed: ${activateResult.error}`);
        }
      }

      // Clean up temporary directory
      if (tempClonePath) {
        await fs.remove(tempClonePath);
        tempClonePath = null;
      }

      // Step 6: Get plugin info from WP-CLI
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, config.slug);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Plugin installed successfully'
        });
      }

      // Create plugin object
      const plugin: WordPressPlugin = {
        id: pluginId,
        name: config.name,
        gitUrl: config.gitUrl,
        branch: config.branch,
        subdirectory: config.subdirectory,
        slug: config.slug,
        status: finalStatus,
        installedPath: pluginInstallPath,
        version: pluginInfo?.version,
        createdAt: new Date()
      };

      return plugin;

    } catch (error: any) {
      // Clean up on error
      if (tempClonePath) {
        try {
          await fs.remove(tempClonePath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      // Return error plugin object
      const plugin: WordPressPlugin = {
        id: pluginId,
        name: config.name,
        gitUrl: config.gitUrl,
        branch: config.branch,
        subdirectory: config.subdirectory,
        slug: config.slug,
        status: 'error',
        installedPath: '',
        error: this.sanitizeError(error),
        createdAt: new Date()
      };

      throw error;
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(site: Local.Site, slug: string): Promise<WpCliResult> {
    return await this.wpCliManager.activatePlugin(site, slug);
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(site: Local.Site, slug: string): Promise<WpCliResult> {
    return await this.wpCliManager.deactivatePlugin(site, slug);
  }

  /**
   * Remove a plugin (deactivates first, then deletes)
   */
  async removePlugin(site: Local.Site, slug: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Check if plugin is installed
      const isInstalled = await this.wpCliManager.isPluginInstalled(site, slug);
      if (!isInstalled) {
        return {
          success: false,
          error: 'Plugin is not installed'
        };
      }

      // Step 2: Get current plugin status
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, slug);

      // Step 3: Deactivate if active
      if (pluginInfo && pluginInfo.status === 'active') {
        const deactivateResult = await this.wpCliManager.deactivatePlugin(site, slug);
        if (!deactivateResult.success) {
          return {
            success: false,
            error: `Failed to deactivate plugin: ${deactivateResult.error}`
          };
        }
      }

      // Step 4: Delete plugin
      const deleteResult = await this.wpCliManager.deletePlugin(site, slug);
      if (!deleteResult.success) {
        return {
          success: false,
          error: `Failed to delete plugin: ${deleteResult.error}`
        };
      }

      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        error: this.sanitizeError(error)
      };
    }
  }

  /**
   * Update a plugin from Git repository
   * Removes the old version and reinstalls from the latest commit
   */
  async updatePlugin(
    site: Local.Site,
    plugin: WordPressPlugin,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    try {
      // Check if plugin was active before removal
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, plugin.slug);
      const wasActive = pluginInfo?.status === 'active';

      // Remove existing plugin
      const removeResult = await this.removePlugin(site, plugin.slug);
      if (!removeResult.success) {
        throw new Error(removeResult.error);
      }

      // Reinstall plugin
      const updatedPlugin = await this.installPlugin(
        site,
        {
          name: plugin.name,
          gitUrl: plugin.gitUrl,
          branch: plugin.branch,
          subdirectory: plugin.subdirectory,
          slug: plugin.slug,
          autoActivate: wasActive
        },
        onProgress
      );

      return {
        ...updatedPlugin,
        id: plugin.id, // Preserve original ID
        updatedAt: new Date()
      };

    } catch (error: any) {
      throw new Error(`Failed to update plugin: ${this.sanitizeError(error)}`);
    }
  }

  /**
   * Validate plugin directory structure
   * A valid WordPress plugin must have a main PHP file with plugin headers
   */
  private async validatePluginStructure(
    pluginDir: string,
    expectedSlug: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if directory exists
      if (!await fs.pathExists(pluginDir)) {
        return {
          valid: false,
          error: 'Plugin directory does not exist'
        };
      }

      // Look for the main plugin file (should match slug or be named similarly)
      const possibleMainFiles = [
        `${expectedSlug}.php`,
        'plugin.php',
        'index.php'
      ];

      let mainFileFound = false;
      for (const fileName of possibleMainFiles) {
        const filePath = path.join(pluginDir, fileName);
        if (await fs.pathExists(filePath)) {
          // Read file and check for plugin headers
          const content = await fs.readFile(filePath, 'utf-8');
          if (this.hasPluginHeaders(content)) {
            mainFileFound = true;
            break;
          }
        }
      }

      if (!mainFileFound) {
        // Try to find any PHP file with plugin headers
        const files = await fs.readdir(pluginDir);
        for (const file of files) {
          if (file.endsWith('.php')) {
            const filePath = path.join(pluginDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            if (this.hasPluginHeaders(content)) {
              mainFileFound = true;
              break;
            }
          }
        }
      }

      if (!mainFileFound) {
        return {
          valid: false,
          error: 'No valid WordPress plugin file found. Plugin must contain a PHP file with plugin headers (Plugin Name, Description, etc.)'
        };
      }

      return { valid: true };

    } catch (error: any) {
      return {
        valid: false,
        error: `Validation error: ${this.sanitizeError(error)}`
      };
    }
  }

  /**
   * Check if file content contains WordPress plugin headers
   */
  private hasPluginHeaders(content: string): boolean {
    // WordPress plugin headers typically include at minimum "Plugin Name:"
    const pluginHeaderPattern = /\/\*\*[\s\S]*?Plugin Name:\s*.+[\s\S]*?\*\//i;
    return pluginHeaderPattern.test(content);
  }

  /**
   * Validate plugin slug format
   */
  private isValidPluginSlug(slug: string): boolean {
    if (!slug || typeof slug !== 'string') {
      return false;
    }

    // Length check
    if (slug.length === 0 || slug.length > 200) {
      return false;
    }

    // Format check: lowercase alphanumeric, hyphens, underscores only
    const validSlugPattern = /^[a-z0-9_-]+$/;
    return validSlugPattern.test(slug);
  }

  /**
   * Sanitize error messages
   */
  private sanitizeError(error: any): string {
    if (!error) {
      return 'Unknown error occurred';
    }

    let message = error.message || String(error);

    // Remove user paths
    message = message.replace(/\/Users\/[^/\s]+/g, '[USER]');
    message = message.replace(/\/home\/[^/\s]+/g, '[USER]');
    message = message.replace(/C:\\Users\\[^\\s]+/g, '[USER]');

    return message;
  }

  /**
   * Get list of all installed plugins
   */
  async listPlugins(site: Local.Site) {
    return await this.wpCliManager.listPlugins(site);
  }
}
