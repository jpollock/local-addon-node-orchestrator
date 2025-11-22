/**
 * ConfigManager - Configuration persistence for Node.js apps
 * Handles saving and loading app configurations per site
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { NodeApp, SiteNodeApps, WordPressPlugin, SiteWordPressPlugins } from '../types';

export interface ConfigManagerOptions {
  configPath?: string;
}

export class ConfigManager {
  private configPath: string;
  private configCache: Map<string, SiteNodeApps> = new Map();
  private pluginCache: Map<string, SiteWordPressPlugins> = new Map();

  constructor(options: ConfigManagerOptions = {}) {
    // Default config path can be overridden for testing
    this.configPath = options.configPath || '';
  }

  /**
   * Get configuration file path for a site
   */
  private getConfigFilePath(siteId: string, sitePath: string): string {
    if (this.configPath) {
      // Use override path (for testing)
      return path.join(this.configPath, `${siteId}.json`);
    }

    // Production path: within site directory
    const configDir = path.join(sitePath, 'conf', 'node-apps');
    return path.join(configDir, 'apps.json');
  }

  /**
   * Get plugins configuration file path for a site
   */
  private getPluginsConfigFilePath(siteId: string, sitePath: string): string {
    if (this.configPath) {
      // Use override path (for testing)
      return path.join(this.configPath, `${siteId}-plugins.json`);
    }

    // Production path: within site directory
    const configDir = path.join(sitePath, 'conf', 'node-apps');
    return path.join(configDir, 'plugins.json');
  }

  /**
   * Load apps configuration for a site
   */
  async loadApps(siteId: string, sitePath: string): Promise<NodeApp[]> {
    try {
      // Check cache first
      const cached = this.configCache.get(siteId);
      if (cached) {
        return cached.apps;
      }

      const configFile = this.getConfigFilePath(siteId, sitePath);

      // Check if config file exists
      if (!await fs.pathExists(configFile)) {
        // No config yet, return empty array
        return [];
      }

      // Read and parse config
      const config = await fs.readJson(configFile);

      // Validate structure
      if (!config.siteId || !Array.isArray(config.apps)) {
        throw new Error('Invalid config file structure');
      }

      // Cache the result
      this.configCache.set(siteId, config);

      return config.apps;
    } catch (error: any) {
      // If file is corrupt or invalid, start fresh
      console.error(`Failed to load config for site ${siteId}:`, error);
      return [];
    }
  }

  /**
   * Save apps configuration for a site
   */
  async saveApps(siteId: string, sitePath: string, apps: NodeApp[]): Promise<void> {
    try {
      const configFile = this.getConfigFilePath(siteId, sitePath);

      // Ensure config directory exists
      const configDir = path.dirname(configFile);
      await fs.ensureDir(configDir);

      // Prepare config data
      const config: SiteNodeApps = {
        siteId,
        apps
      };

      // Write to file with pretty formatting
      await fs.writeJson(configFile, config, { spaces: 2 });

      // Update cache
      this.configCache.set(siteId, config);
    } catch (error: any) {
      throw new Error(`Failed to save config for site ${siteId}: ${error.message}`);
    }
  }

  /**
   * Get single app configuration
   */
  async getApp(siteId: string, sitePath: string, appId: string): Promise<NodeApp | null> {
    const apps = await this.loadApps(siteId, sitePath);
    return apps.find(app => app.id === appId) || null;
  }

  /**
   * Add or update an app configuration
   */
  async saveApp(siteId: string, sitePath: string, app: NodeApp): Promise<void> {
    const apps = await this.loadApps(siteId, sitePath);

    // Find existing app index
    const existingIndex = apps.findIndex(a => a.id === app.id);

    if (existingIndex >= 0) {
      // Update existing app
      apps[existingIndex] = app;
    } else {
      // Add new app
      apps.push(app);
    }

    await this.saveApps(siteId, sitePath, apps);
  }

  /**
   * Remove an app configuration
   */
  async removeApp(siteId: string, sitePath: string, appId: string): Promise<void> {
    const apps = await this.loadApps(siteId, sitePath);

    // Filter out the app to remove
    const filteredApps = apps.filter(app => app.id !== appId);

    await this.saveApps(siteId, sitePath, filteredApps);
  }

  /**
   * Clear cache for a site
   */
  clearCache(siteId: string): void {
    this.configCache.delete(siteId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.configCache.clear();
  }

  /**
   * Check if site has any apps configured
   */
  async hasApps(siteId: string, sitePath: string): Promise<boolean> {
    const apps = await this.loadApps(siteId, sitePath);
    return apps.length > 0;
  }

  /**
   * Get all sites with configured apps (for testing/debugging)
   */
  getCachedSites(): string[] {
    return Array.from(this.configCache.keys());
  }

  /**
   * Export configuration for backup
   */
  async exportConfig(siteId: string, sitePath: string): Promise<string> {
    const apps = await this.loadApps(siteId, sitePath);
    const config: SiteNodeApps = { siteId, apps };
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfig(siteId: string, sitePath: string, configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);

      // Validate structure
      if (!config.apps || !Array.isArray(config.apps)) {
        throw new Error('Invalid config format');
      }

      // Save imported apps
      await this.saveApps(siteId, sitePath, config.apps);
    } catch (error: any) {
      throw new Error(`Failed to import config: ${error.message}`);
    }
  }

  // ========================================
  // WordPress Plugin Configuration Methods
  // ========================================

  /**
   * Load plugins configuration for a site
   */
  async loadPlugins(siteId: string, sitePath: string): Promise<WordPressPlugin[]> {
    try {
      // Check cache first
      const cached = this.pluginCache.get(siteId);
      if (cached) {
        return cached.plugins;
      }

      const configFile = this.getPluginsConfigFilePath(siteId, sitePath);

      // Check if config file exists
      if (!await fs.pathExists(configFile)) {
        // No config yet, return empty array
        return [];
      }

      // Read and parse config
      const config = await fs.readJson(configFile);

      // Validate structure
      if (!config.siteId || !Array.isArray(config.plugins)) {
        throw new Error('Invalid plugins config file structure');
      }

      // Cache the result
      this.pluginCache.set(siteId, config);

      return config.plugins;
    } catch (error: any) {
      // If file is corrupt or invalid, start fresh
      console.error(`Failed to load plugins config for site ${siteId}:`, error);
      return [];
    }
  }

  /**
   * Save plugins configuration for a site
   */
  async savePlugins(siteId: string, sitePath: string, plugins: WordPressPlugin[]): Promise<void> {
    try {
      const configFile = this.getPluginsConfigFilePath(siteId, sitePath);

      // Ensure config directory exists
      const configDir = path.dirname(configFile);
      await fs.ensureDir(configDir);

      // Prepare config data
      const config: SiteWordPressPlugins = {
        siteId,
        plugins
      };

      // Write to file with pretty formatting
      await fs.writeJson(configFile, config, { spaces: 2 });

      // Update cache
      this.pluginCache.set(siteId, config);
    } catch (error: any) {
      throw new Error(`Failed to save plugins config for site ${siteId}: ${error.message}`);
    }
  }

  /**
   * Get single plugin configuration
   */
  async getPlugin(siteId: string, sitePath: string, pluginId: string): Promise<WordPressPlugin | null> {
    const plugins = await this.loadPlugins(siteId, sitePath);
    return plugins.find(plugin => plugin.id === pluginId) || null;
  }

  /**
   * Add or update a plugin configuration
   */
  async savePlugin(siteId: string, sitePath: string, plugin: WordPressPlugin): Promise<void> {
    const plugins = await this.loadPlugins(siteId, sitePath);

    // Find existing plugin index
    const existingIndex = plugins.findIndex(p => p.id === plugin.id);

    if (existingIndex >= 0) {
      // Update existing plugin
      plugins[existingIndex] = plugin;
    } else {
      // Add new plugin
      plugins.push(plugin);
    }

    await this.savePlugins(siteId, sitePath, plugins);
  }

  /**
   * Remove a plugin configuration
   */
  async removePlugin(siteId: string, sitePath: string, pluginId: string): Promise<void> {
    const plugins = await this.loadPlugins(siteId, sitePath);

    // Filter out the plugin to remove
    const filteredPlugins = plugins.filter(plugin => plugin.id !== pluginId);

    await this.savePlugins(siteId, sitePath, filteredPlugins);
  }

  /**
   * Check if site has any plugins configured
   */
  async hasPlugins(siteId: string, sitePath: string): Promise<boolean> {
    const plugins = await this.loadPlugins(siteId, sitePath);
    return plugins.length > 0;
  }

  /**
   * Find plugin by slug
   */
  async findPluginBySlug(siteId: string, sitePath: string, slug: string): Promise<WordPressPlugin | null> {
    const plugins = await this.loadPlugins(siteId, sitePath);
    return plugins.find(plugin => plugin.slug === slug) || null;
  }

  /**
   * Update plugin status
   */
  async updatePluginStatus(
    siteId: string,
    sitePath: string,
    pluginId: string,
    status: WordPressPlugin['status']
  ): Promise<void> {
    const plugin = await this.getPlugin(siteId, sitePath, pluginId);
    if (plugin) {
      plugin.status = status;
      plugin.updatedAt = new Date();
      await this.savePlugin(siteId, sitePath, plugin);
    }
  }
}
