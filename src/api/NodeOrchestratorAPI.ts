/**
 * NodeOrchestratorAPI - Public API for programmatic access
 * Allows other Local addons to manage Node apps and WordPress plugins
 */

import * as Local from '@getflywheel/local';
import * as LocalMain from '@getflywheel/local/main';
import { NodeAppManager, InstallProgress } from '../lib/NodeAppManager';
import { WordPressPluginManager, PluginInstallProgress } from '../lib/wordpress/WordPressPluginManager';
import { ConfigManager } from '../lib/ConfigManager';
import { GitManager } from '../lib/GitManager';
import { WpCliManager } from '../lib/wordpress/WpCliManager';
import {
  NodeApp,
  AddAppRequest,
  PluginConfigInput,
  WordPressPlugin
} from '../types';
import { GitProgressEvent } from '../lib/GitManager';

/**
 * Configuration for adding a Node app
 */
export interface AddNodeAppConfig {
  /** Application name */
  name: string;
  /** Git repository URL */
  gitUrl: string;
  /** Git branch (default: 'main') */
  branch?: string;
  /** Install command (default: auto-detected) */
  installCommand?: string;
  /** Build command (optional) */
  buildCommand?: string;
  /** Start command (default: 'npm start') */
  startCommand?: string;
  /** Node version (default: '20.x') */
  nodeVersion?: string;
  /** Custom environment variables */
  env?: Record<string, string>;
  /** Auto-start with WordPress site (default: false) */
  autoStart?: boolean;
  /** Auto-inject WordPress environment variables (default: true) */
  injectWpEnv?: boolean;
}

/**
 * Progress callback for operations
 */
export type ProgressCallback = (event: GitProgressEvent | InstallProgress | PluginInstallProgress) => void;

/**
 * NodeOrchestratorAPI
 * Main entry point for programmatic interaction with Node Orchestrator
 *
 * @example
 * ```typescript
 * import { NodeOrchestratorAPI } from 'local-addon-node-orchestrator/api';
 *
 * // In your addon's main process
 * const site = siteData.getSite(siteId);
 * const orchestrator = new NodeOrchestratorAPI(site);
 *
 * // Add a Node app
 * const app = await orchestrator.addNodeApp({
 *   name: 'my-api',
 *   gitUrl: 'https://github.com/org/repo.git',
 *   branch: 'main',
 *   autoStart: true
 * });
 *
 * // Add a plugin
 * const plugin = await orchestrator.addPlugin({
 *   source: 'wporg',
 *   slug: 'wp-graphql',
 *   autoActivate: true
 * });
 * ```
 */
export class NodeOrchestratorAPI {
  private site: Local.Site;
  private appManager: NodeAppManager;
  private pluginManager: WordPressPluginManager;
  private configManager: ConfigManager;

  /**
   * Create a new NodeOrchestratorAPI instance
   *
   * @param site - Local site object
   */
  constructor(site: Local.Site) {
    this.site = site;

    // Get services from Local's service container
    const { ports, wpCli, siteProcessManager, siteDatabase } = LocalMain.getServiceContainer().cradle;

    // Initialize managers (same pattern as main-full.ts)
    this.configManager = new ConfigManager();
    const gitManager = new GitManager();
    const wpCliManager = new WpCliManager(wpCli);
    this.pluginManager = new WordPressPluginManager(gitManager, wpCliManager);
    this.appManager = new NodeAppManager(
      this.configManager,
      gitManager,
      ports,
      this.pluginManager,
      siteProcessManager,
      siteDatabase
    );
  }

  /**
   * Add a Node.js application to the site
   *
   * @param config - Application configuration
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to created NodeApp
   *
   * @example
   * ```typescript
   * const app = await api.addNodeApp({
   *   name: 'my-api',
   *   gitUrl: 'https://github.com/org/repo.git',
   *   branch: 'develop',
   *   autoStart: true,
   *   env: {
   *     API_KEY: 'dev-key'
   *   }
   * });
   * ```
   */
  async addNodeApp(config: AddNodeAppConfig, onProgress?: ProgressCallback): Promise<NodeApp> {
    const appConfig: AddAppRequest['app'] = {
      name: config.name,
      gitUrl: config.gitUrl,
      branch: config.branch || 'main',
      installCommand: config.installCommand,
      buildCommand: config.buildCommand,
      startCommand: config.startCommand || 'npm start',
      nodeVersion: config.nodeVersion || '20.x',
      env: config.env || {},
      autoStart: config.autoStart ?? false,
      injectWpEnv: config.injectWpEnv ?? true
    };

    return await this.appManager.addApp(this.site, appConfig, onProgress);
  }

  /**
   * Start a Node.js application
   *
   * @param appId - Application ID
   * @returns Promise resolving when app is started
   */
  async startApp(appId: string): Promise<void> {
    await this.appManager.startApp(this.site.id, this.site.path, appId);
  }

  /**
   * Stop a Node.js application
   *
   * @param appId - Application ID
   * @returns Promise resolving when app is stopped
   */
  async stopApp(appId: string): Promise<void> {
    await this.appManager.stopApp(this.site.id, this.site.path, appId);
  }

  /**
   * Remove a Node.js application
   *
   * @param appId - Application ID
   * @returns Promise resolving when app is removed
   */
  async removeApp(appId: string): Promise<void> {
    await this.appManager.removeApp(this.site.id, this.site.path, appId);
  }

  /**
   * Get all Node.js applications for the site
   *
   * @returns Promise resolving to array of NodeApps
   */
  async getApps(): Promise<NodeApp[]> {
    return await this.appManager.getAppsForSite(this.site.id, this.site.path);
  }

  /**
   * Get a specific Node.js application
   *
   * @param appId - Application ID
   * @returns Promise resolving to NodeApp or null if not found
   */
  async getApp(appId: string): Promise<NodeApp | null> {
    return await this.configManager.getApp(this.site.id, this.site.path, appId);
  }

  /**
   * Update a Node.js application's environment variables
   *
   * @param appId - Application ID
   * @param env - New environment variables (merged with existing)
   * @returns Promise resolving to updated NodeApp
   */
  async updateAppEnv(appId: string, env: Record<string, string>): Promise<NodeApp> {
    return await this.appManager.updateApp(this.site.id, this.site.path, appId, { env });
  }

  /**
   * Add a WordPress plugin
   *
   * @param config - Plugin configuration (discriminated by source)
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to installed WordPressPlugin
   *
   * @example
   * ```typescript
   * // From WordPress.org
   * const plugin1 = await api.addPlugin({
   *   source: 'wporg',
   *   slug: 'wp-graphql',
   *   autoActivate: true
   * });
   *
   * // From Git repository
   * const plugin2 = await api.addPlugin({
   *   source: 'git',
   *   url: 'https://github.com/org/plugin.git',
   *   branch: 'main',
   *   slug: 'my-plugin',
   *   autoActivate: true
   * });
   *
   * // From zip file
   * const plugin3 = await api.addPlugin({
   *   source: 'zip',
   *   url: 'https://example.com/plugin.zip',
   *   slug: 'premium-plugin',
   *   autoActivate: false
   * });
   * ```
   */
  async addPlugin(
    config: PluginConfigInput,
    onProgress?: (event: PluginInstallProgress) => void
  ): Promise<WordPressPlugin> {
    const plugin = await this.pluginManager.installPlugin(this.site, config, onProgress);

    // Save plugin configuration
    await this.configManager.savePlugin(this.site.id, this.site.path, plugin);

    return plugin;
  }

  /**
   * Activate a WordPress plugin
   *
   * @param slug - Plugin slug
   * @returns Promise resolving when plugin is activated
   */
  async activatePlugin(slug: string): Promise<void> {
    const result = await this.pluginManager.activatePlugin(this.site, slug);
    if (!result.success) {
      throw new Error(result.error || 'Failed to activate plugin');
    }
  }

  /**
   * Deactivate a WordPress plugin
   *
   * @param slug - Plugin slug
   * @returns Promise resolving when plugin is deactivated
   */
  async deactivatePlugin(slug: string): Promise<void> {
    const result = await this.pluginManager.deactivatePlugin(this.site, slug);
    if (!result.success) {
      throw new Error(result.error || 'Failed to deactivate plugin');
    }
  }

  /**
   * Remove a WordPress plugin
   *
   * @param slug - Plugin slug
   * @returns Promise resolving when plugin is removed
   */
  async removePlugin(slug: string): Promise<void> {
    const result = await this.pluginManager.removePlugin(this.site, slug);
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove plugin');
    }
  }

  /**
   * Get all WordPress plugins for the site
   *
   * @returns Promise resolving to array of WordPressPlugins
   */
  async getPlugins(): Promise<WordPressPlugin[]> {
    return await this.configManager.loadPlugins(this.site.id, this.site.path);
  }

  /**
   * Get a specific WordPress plugin
   *
   * @param pluginId - Plugin ID
   * @returns Promise resolving to WordPressPlugin or null if not found
   */
  async getPlugin(pluginId: string): Promise<WordPressPlugin | null> {
    return await this.configManager.getPlugin(this.site.id, this.site.path, pluginId);
  }
}
