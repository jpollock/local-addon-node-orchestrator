/**
 * BundledPluginDetector - Detects WordPress plugins bundled with Node apps
 * Supports both config-driven (.nodeorchestrator.json) and convention-based detection
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import {
  PluginConfig,
  NodeOrchestratorConfigSchema,
  BundledPluginConfig
} from '../schemas/nodeOrchestratorConfig';

/**
 * Conventional directory names to scan for bundled plugins
 */
const CONVENTIONAL_PLUGIN_PATHS = [
  'wp-plugin',
  'wordpress-plugin',
  'plugin',
  'plugins/wordpress', // Nested convention
];

/**
 * Configuration file name
 */
const CONFIG_FILE_NAME = '.nodeorchestrator.json';

/**
 * Detection result with plugin configs and metadata
 */
export interface DetectionResult {
  plugins: PluginConfig[];
  source: 'config' | 'convention';
  configPath?: string;
  scannedPaths?: string[];
}

/**
 * BundledPluginDetector
 * Detects WordPress plugins that should be installed alongside a Node app
 */
export class BundledPluginDetector {
  /**
   * Detect all WordPress plugins in a repository
   *
   * @param repoPath - Absolute path to cloned repository
   * @returns Detection result with plugin configurations
   */
  async detectPlugins(repoPath: string): Promise<DetectionResult> {
    // Security: Validate repoPath exists and is a directory
    if (!await this.isValidDirectory(repoPath)) {
      throw new Error('Invalid repository path: not a directory');
    }

    // Step 1: Check for .nodeorchestrator.json
    const configPath = path.join(repoPath, CONFIG_FILE_NAME);
    if (await fs.pathExists(configPath)) {
      return await this.detectFromConfig(repoPath, configPath);
    }

    // Step 2: Fall back to convention-based detection
    return await this.detectFromConventions(repoPath);
  }

  /**
   * Parse .nodeorchestrator.json and extract plugin configurations
   */
  private async detectFromConfig(
    repoPath: string,
    configPath: string
  ): Promise<DetectionResult> {
    try {
      // Read config file
      const configContent = await fs.readFile(configPath, 'utf-8');
      const configJson = JSON.parse(configContent);

      // Validate with Zod schema
      const parseResult = NodeOrchestratorConfigSchema.safeParse(configJson);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map((e: any) => e.message).join(', ');
        throw new Error(
          `Invalid ${CONFIG_FILE_NAME}: ${errorMessages}`
        );
      }

      const config = parseResult.data;
      const plugins = config.wordpress?.plugins || [];

      // Validate bundled plugin paths
      for (const plugin of plugins) {
        if (plugin.source === 'bundled') {
          await this.validateBundledPluginPath(repoPath, plugin.path);
        }
      }

      return {
        plugins,
        source: 'config',
        configPath,
      };
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        throw error; // Re-throw validation errors
      }
      throw new Error(`Failed to parse ${CONFIG_FILE_NAME}: ${error.message}`);
    }
  }

  /**
   * Scan conventional paths for WordPress plugins
   */
  private async detectFromConventions(repoPath: string): Promise<DetectionResult> {
    const detectedPlugins: BundledPluginConfig[] = [];
    const scannedPaths: string[] = [];

    for (const conventionalPath of CONVENTIONAL_PLUGIN_PATHS) {
      const pluginPath = path.join(repoPath, conventionalPath);
      scannedPaths.push(conventionalPath);

      // Check if path exists
      if (!await fs.pathExists(pluginPath)) {
        continue;
      }

      // Verify it's a directory
      const stats = await fs.stat(pluginPath);
      if (!stats.isDirectory()) {
        continue;
      }

      // Check if it's a valid WordPress plugin
      if (await this.hasPluginHeaders(pluginPath)) {
        // Use the last segment of the path as slug
        const slug = path.basename(conventionalPath);

        detectedPlugins.push({
          source: 'bundled',
          path: conventionalPath,
          slug,
          autoActivate: true, // Auto-activate by default
        });
      }
    }

    return {
      plugins: detectedPlugins,
      source: 'convention',
      scannedPaths,
    };
  }

  /**
   * Validate bundled plugin path for security
   * Prevents path traversal attacks
   */
  private async validateBundledPluginPath(
    repoPath: string,
    pluginPath: string
  ): Promise<void> {
    // Construct full path
    const fullPath = path.join(repoPath, pluginPath);

    // Security: Prevent path traversal
    const resolvedPath = path.resolve(fullPath);
    const resolvedRepoPath = path.resolve(repoPath);

    if (!resolvedPath.startsWith(resolvedRepoPath)) {
      throw new Error(
        `Security violation: Plugin path "${pluginPath}" attempts to escape repository`
      );
    }

    // Verify path exists
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`Plugin path not found: ${pluginPath}`);
    }

    // Verify it's a directory
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      throw new Error(`Plugin path is not a directory: ${pluginPath}`);
    }

    // Verify it contains WordPress plugin files
    if (!await this.hasPluginHeaders(fullPath)) {
      throw new Error(
        `Invalid WordPress plugin: ${pluginPath} (no plugin headers found)`
      );
    }
  }

  /**
   * Check if directory contains valid WordPress plugin headers
   */
  private async hasPluginHeaders(pluginDir: string): Promise<boolean> {
    try {
      const files = await fs.readdir(pluginDir);

      // Look for PHP files
      const phpFiles = files.filter(file => file.endsWith('.php'));

      // Check each PHP file for plugin headers
      for (const phpFile of phpFiles) {
        const filePath = path.join(pluginDir, phpFile);
        const content = await fs.readFile(filePath, 'utf-8');

        // WordPress plugin headers typically include "Plugin Name:"
        if (this.hasPluginHeadersInContent(content)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file content contains WordPress plugin headers
   */
  private hasPluginHeadersInContent(content: string): boolean {
    // WordPress plugin headers pattern
    const pluginHeaderPattern = /\/\*\*[\s\S]*?Plugin Name:\s*.+[\s\S]*?\*\//i;
    return pluginHeaderPattern.test(content);
  }

  /**
   * Validate directory path
   */
  private async isValidDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}
