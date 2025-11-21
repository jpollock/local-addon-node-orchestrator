/**
 * ConfigManager - Configuration persistence for Node.js apps
 * Handles saving and loading app configurations per site
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { NodeApp, SiteNodeApps } from '../types';

export interface ConfigManagerOptions {
  configPath?: string;
}

export class ConfigManager {
  private configPath: string;
  private configCache: Map<string, SiteNodeApps> = new Map();

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
}
