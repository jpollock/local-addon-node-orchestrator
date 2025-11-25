/**
 * WordPressPluginManager - Manages WordPress plugin installation and lifecycle
 * Supports multiple installation sources: git, bundled, zip, and wp.org
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as Local from '@getflywheel/local';
import { v4 as uuidv4 } from 'uuid';
import { GitManager } from '../GitManager';
import { WpCliManager, WpCliResult } from './WpCliManager';
import { ZipPluginInstaller } from './ZipPluginInstaller';
import {
  WordPressPlugin,
  PluginConfig,
  BundledPluginConfig,
  GitPluginConfig,
  ZipPluginConfig,
  WpOrgPluginConfig
} from '../../types';

export interface PluginInstallProgress {
  phase: 'cloning' | 'downloading' | 'copying' | 'validating' | 'activating' | 'complete';
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
  private zipInstaller: ZipPluginInstaller;

  constructor(gitManager: GitManager, wpCliManager: WpCliManager) {
    this.gitManager = gitManager;
    this.wpCliManager = wpCliManager;
    this.zipInstaller = new ZipPluginInstaller();
  }

  /**
   * Install a WordPress plugin from any supported source
   *
   * @param site - The Local site object
   * @param config - Plugin installation configuration (discriminated by source)
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to installed plugin
   */
  async installPlugin(
    site: Local.Site,
    config: PluginConfig & { name?: string },
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
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

    // Dispatch to appropriate installation method based on source
    let pluginResult: WordPressPlugin;

    switch (config.source) {
      case 'bundled':
        pluginResult = await this.installFromBundled(site, config, pluginInstallPath, onProgress);
        break;
      case 'git':
        pluginResult = await this.installFromGit(site, config, pluginInstallPath, onProgress);
        break;
      case 'zip':
        pluginResult = await this.installFromZip(site, config, pluginInstallPath, onProgress);
        break;
      case 'wporg':
        pluginResult = await this.installFromWpOrg(site, config, pluginInstallPath, onProgress);
        break;
      default:
        throw new Error(`Unsupported plugin source: ${(config as any).source}`);
    }

    return pluginResult;
  }

  /**
   * Install plugin from bundled path within a repository
   */
  private async installFromBundled(
    site: Local.Site,
    config: BundledPluginConfig & { name?: string },
    targetPath: string,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const pluginId = uuidv4();

    try {
      // The bundled path should be absolute (passed from BundledPluginDetector)
      // If it's relative, it would be relative to the node app repository
      const sourcePath = path.isAbsolute(config.path)
        ? config.path
        : config.path; // Will be resolved by caller

      if (onProgress) {
        onProgress({
          phase: 'validating',
          progress: 20,
          message: 'Validating bundled plugin...'
        });
      }

      // Validate source exists
      if (!await fs.pathExists(sourcePath)) {
        throw new Error(`Bundled plugin path not found: ${config.path}`);
      }

      // Validate plugin structure
      const validationResult = await this.validatePluginStructure(sourcePath, config.slug);
      if (!validationResult.valid) {
        throw new Error(validationResult.error || 'Invalid plugin structure');
      }

      if (onProgress) {
        onProgress({
          phase: 'copying',
          progress: 50,
          message: 'Installing bundled plugin...'
        });
      }

      // Copy plugin files
      await fs.copy(sourcePath, targetPath, {
        overwrite: false,
        errorOnExist: true
      });

      // Activate if requested
      const finalStatus = await this.handleActivation(site, config.slug, config.autoActivate, onProgress);

      // Get plugin info
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, config.slug);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Bundled plugin installed successfully'
        });
      }

      return {
        id: pluginId,
        name: config.name || config.slug,
        slug: config.slug,
        source: 'bundled',
        status: finalStatus,
        installedPath: targetPath,
        bundledPath: config.path,
        version: pluginInfo?.version,
        createdAt: new Date()
      };

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Install plugin from Git repository
   */
  private async installFromGit(
    site: Local.Site,
    config: GitPluginConfig & { name?: string },
    targetPath: string,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const pluginId = uuidv4();
    let tempClonePath: string | null = null;

    try {
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
        url: config.url,
        branch: config.branch,
        targetPath: tempClonePath,
        requirePackageJson: false // WordPress plugins are PHP, not Node.js
      });

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone plugin repository');
      }

      // Use repository root as source directory
      const sourceDir = tempClonePath;

      // Validate plugin structure
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

      // Copy plugin files
      if (onProgress) {
        onProgress({
          phase: 'copying',
          progress: 60,
          message: 'Installing plugin files...'
        });
      }

      await fs.copy(sourceDir, targetPath, {
        overwrite: false,
        errorOnExist: true
      });

      // Clean up temporary directory
      await fs.remove(tempClonePath);
      tempClonePath = null;

      // Activate if requested
      const finalStatus = await this.handleActivation(site, config.slug, config.autoActivate, onProgress);

      // Get plugin info
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, config.slug);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Plugin installed successfully'
        });
      }

      return {
        id: pluginId,
        name: config.name || config.slug,
        slug: config.slug,
        source: 'git',
        status: finalStatus,
        installedPath: targetPath,
        gitUrl: config.url,
        branch: config.branch,
        version: pluginInfo?.version,
        createdAt: new Date()
      };

    } catch (error: any) {
      // Clean up on error
      if (tempClonePath) {
        try {
          await fs.remove(tempClonePath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Install plugin from zip file (local or remote)
   */
  private async installFromZip(
    site: Local.Site,
    config: ZipPluginConfig & { name?: string },
    targetPath: string,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const pluginId = uuidv4();

    try {
      if (onProgress) {
        onProgress({
          phase: 'downloading',
          progress: 0,
          message: 'Downloading plugin zip...'
        });
      }

      // Use ZipPluginInstaller to handle download/extraction
      const result = await this.zipInstaller.installFromZip(
        config.url,
        targetPath,
        (zipProgress) => {
          if (onProgress && zipProgress.percentage) {
            onProgress({
              phase: 'downloading',
              progress: Math.round(zipProgress.percentage * 0.7), // 0-70% for download
              message: `Downloading... ${zipProgress.percentage}%`
            });
          }
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to install from zip');
      }

      // Validate plugin structure
      if (onProgress) {
        onProgress({
          phase: 'validating',
          progress: 75,
          message: 'Validating plugin...'
        });
      }

      const validationResult = await this.validatePluginStructure(targetPath, config.slug);
      if (!validationResult.valid) {
        // Clean up invalid plugin
        await fs.remove(targetPath);
        throw new Error(validationResult.error || 'Invalid plugin structure');
      }

      // Activate if requested
      const finalStatus = await this.handleActivation(site, config.slug, config.autoActivate, onProgress);

      // Get plugin info
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, config.slug);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Plugin installed from zip successfully'
        });
      }

      return {
        id: pluginId,
        name: config.name || config.slug,
        slug: config.slug,
        source: 'zip',
        status: finalStatus,
        installedPath: targetPath,
        zipUrl: config.url,
        version: pluginInfo?.version,
        createdAt: new Date()
      };

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Install plugin from WordPress.org
   */
  private async installFromWpOrg(
    site: Local.Site,
    config: WpOrgPluginConfig & { name?: string },
    targetPath: string,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const pluginId = uuidv4();

    try {
      if (onProgress) {
        onProgress({
          phase: 'downloading',
          progress: 0,
          message: 'Installing from WordPress.org...'
        });
      }

      // Use WP-CLI to install plugin
      const installCommand = config.version
        ? `plugin install ${config.slug} --version=${config.version}`
        : `plugin install ${config.slug}`;

      const installResult = await this.wpCliManager.runCommand(site, installCommand);

      if (!installResult.success) {
        throw new Error(installResult.error || 'Failed to install from WordPress.org');
      }

      if (onProgress) {
        onProgress({
          phase: 'validating',
          progress: 60,
          message: 'Plugin downloaded from WordPress.org'
        });
      }

      // Activate if requested
      const finalStatus = await this.handleActivation(site, config.slug, config.autoActivate, onProgress);

      // Get plugin info
      const pluginInfo = await this.wpCliManager.getPluginStatus(site, config.slug);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Plugin installed from WordPress.org'
        });
      }

      return {
        id: pluginId,
        name: config.name || config.slug,
        slug: config.slug,
        source: 'wporg',
        status: finalStatus,
        installedPath: targetPath,
        version: pluginInfo?.version || config.version,
        createdAt: new Date()
      };

    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Handle plugin activation if requested
   */
  private async handleActivation(
    site: Local.Site,
    slug: string,
    autoActivate: boolean | undefined,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin['status']> {
    if (!autoActivate) {
      return 'installed';
    }

    if (onProgress) {
      onProgress({
        phase: 'activating',
        progress: 90,
        message: 'Activating plugin...'
      });
    }

    const activateResult = await this.wpCliManager.activatePlugin(site, slug);
    if (activateResult.success) {
      return 'active';
    } else {
      console.warn(`Plugin installed but activation failed: ${activateResult.error}`);
      return 'installed';
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
   * Update a plugin (remove and reinstall)
   * Note: Only works for plugins with stored installation config
   */
  async updatePlugin(
    site: Local.Site,
    plugin: WordPressPlugin,
    config: PluginConfig & { name?: string },
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

      // Reinstall plugin with same config but preserve active state
      const updatedPlugin = await this.installPlugin(
        site,
        {
          ...config,
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
    message = message.replace(/C:\\Users\\[^\\\s]+/g, '[USER]');

    return message;
  }

  /**
   * Get list of all installed plugins
   */
  async listPlugins(site: Local.Site) {
    return await this.wpCliManager.listPlugins(site);
  }
}
