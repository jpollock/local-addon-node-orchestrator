/**
 * NpmManager - Smart npm detection and execution
 *
 * Provides hybrid npm support:
 * 1. Tries to use system npm when available (0 MB overhead, user's preferred version)
 * 2. Falls back to bundled npm when system npm not found (guaranteed to work)
 *
 * This ensures users don't need Node.js installed, but benefits from it when they do.
 */

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger';

export type NpmType = 'system' | 'bundled';

export interface NpmInfo {
  type: NpmType;
  path: string;
  version?: string;
}

export interface NpmOptions {
  cwd: string;
  onProgress?: (output: string) => void;
  env?: Record<string, string>;
}

export class NpmManager {
  private cachedNpmInfo?: NpmInfo;
  private cachedNpmPath?: string;

  // Debug flag: set to true to force using bundled npm (for testing)
  private static FORCE_BUNDLED_NPM = process.env.FORCE_BUNDLED_NPM === 'true';

  /**
   * Resolve the full path to system npm executable
   * Uses 'which' on Unix or 'where' on Windows to find npm in PATH
   * Returns null if npm is not found
   */
  private resolveSystemNpmPath(): string | null {
    try {
      const command = process.platform === 'win32' ? 'where npm' : 'which npm';
      const result = execSync(command, { encoding: 'utf-8', timeout: 3000 });
      const npmPath = result.trim().split('\n')[0]; // Take first result

      if (npmPath && fs.existsSync(npmPath)) {
        return npmPath;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect if system npm is available and cache its path
   */
  private async detectSystemNpm(): Promise<boolean> {
    // For testing: force bundled npm
    if (NpmManager.FORCE_BUNDLED_NPM) {
      logger.npm.debug('FORCE_BUNDLED_NPM enabled - skipping system npm detection');
      return false;
    }

    // Resolve npm path synchronously (fast operation)
    const npmPath = this.resolveSystemNpmPath();

    if (!npmPath) {
      logger.npm.debug('System npm not found in PATH');
      return false;
    }

    // Verify npm works by checking version (shell: false for security)
    return new Promise((resolve) => {
      const child = spawn(npmPath, ['--version'], {
        shell: false, // Security: use resolved path, no shell
        timeout: 3000,
        stdio: 'pipe'
      });

      child.on('exit', (code) => {
        if (code === 0) {
          this.cachedNpmPath = npmPath;
          resolve(true);
        } else {
          resolve(false);
        }
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get path to bundled npm-cli.js
   */
  private getBundledNpmPath(): string | null {
    // Find addon root by looking for package.json with our addon name
    let currentDir = __dirname;
    const maxDepth = 10;
    let depth = 0;

    while (currentDir !== path.dirname(currentDir) && depth < maxDepth) {
      const pkgPath = path.join(currentDir, 'package.json');

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

          // Check if this is our addon
          if (pkg.name === '@local/node-orchestrator') {
            const npmCliPath = path.join(currentDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');

            if (fs.existsSync(npmCliPath)) {
              return npmCliPath;
            }

            // npm not found in expected location
            logger.npm.warn('Bundled npm not found at expected path', { npmCliPath });
            return null;
          }
        } catch (error) {
          // Invalid package.json, continue searching
        }
      }

      currentDir = path.dirname(currentDir);
      depth++;
    }

    logger.npm.warn('Could not find addon root');
    return null;
  }

  /**
   * Get npm information (system or bundled)
   * Caches the result for performance
   */
  async getNpmInfo(): Promise<NpmInfo> {
    if (this.cachedNpmInfo) {
      return this.cachedNpmInfo;
    }

    // Try system npm first
    const hasSystemNpm = await this.detectSystemNpm();

    if (hasSystemNpm && this.cachedNpmPath) {
      logger.npm.info('Using system npm', { path: this.cachedNpmPath });
      this.cachedNpmInfo = {
        type: 'system',
        path: this.cachedNpmPath // Use resolved absolute path
      };
      return this.cachedNpmInfo;
    }

    // Fall back to bundled npm
    logger.npm.debug('System npm not found, checking bundled npm...');
    const bundledPath = this.getBundledNpmPath();

    if (bundledPath) {
      logger.npm.info('Using bundled npm', { bundledPath });
      this.cachedNpmInfo = {
        type: 'bundled',
        path: bundledPath
      };
      return this.cachedNpmInfo;
    }

    throw new Error(
      'npm not found. Please install Node.js from https://nodejs.org ' +
      'or reinstall this addon to get bundled npm.'
    );
  }

  /**
   * Run npm install in a project directory
   */
  async install(options: NpmOptions): Promise<void> {
    return this.runCommand(['install'], options);
  }

  /**
   * Run npm command with arguments
   */
  async runCommand(args: string[], options: NpmOptions): Promise<void> {
    const npmInfo = await this.getNpmInfo();

    if (npmInfo.type === 'system') {
      return this.runSystemNpm(args, options);
    } else {
      return this.runBundledNpm(npmInfo.path, args, options);
    }
  }

  /**
   * Execute system npm command using resolved path (shell: false for security)
   */
  private runSystemNpm(args: string[], options: NpmOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use cached npm path (resolved during detection)
      const npmPath = this.cachedNpmPath;

      if (!npmPath) {
        reject(new Error('System npm path not resolved'));
        return;
      }

      logger.npm.debug('Running system npm', { command: `${npmPath} ${args.join(' ')}` });

      const child = spawn(npmPath, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env
        },
        shell: false, // Security: use resolved path, no shell injection risk
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Capture output for progress callback
      if (options.onProgress) {
        child.stdout?.on('data', (data) => {
          options.onProgress!(data.toString());
        });

        child.stderr?.on('data', (data) => {
          options.onProgress!(data.toString());
        });
      }

      child.on('exit', (code) => {
        if (code === 0) {
          logger.npm.debug('npm completed successfully', { command: args[0] });
          resolve();
        } else {
          const error = new Error(`npm ${args.join(' ')} failed with exit code ${code}`);
          logger.npm.error('npm command failed', { error: error.message });
          reject(error);
        }
      });

      child.on('error', (error) => {
        logger.npm.error('npm error', { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Execute bundled npm command using Local's Node.js
   */
  private runBundledNpm(npmCliPath: string, args: string[], options: NpmOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.npm.debug('Running bundled npm', { command: `node ${npmCliPath} ${args.join(' ')}` });

      const child = spawn(process.execPath, [npmCliPath, ...args], {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
          // Critical: Tell Electron to run as Node.js
          ELECTRON_RUN_AS_NODE: '1',
          // Configure npm to use project directory
          NPM_CONFIG_PREFIX: options.cwd,
          NPM_CONFIG_CACHE: path.join(options.cwd, '.npm-cache'),
          // Inherit PATH for npm to find system tools
          PATH: process.env.PATH
        },
        shell: false,  // Security: prevent command injection
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Capture output for progress callback
      if (options.onProgress) {
        child.stdout?.on('data', (data) => {
          options.onProgress!(data.toString());
        });

        child.stderr?.on('data', (data) => {
          options.onProgress!(data.toString());
        });
      }

      child.on('exit', (code) => {
        if (code === 0) {
          logger.npm.debug('bundled npm completed successfully', { command: args[0] });
          resolve();
        } else {
          const error = new Error(`Bundled npm ${args.join(' ')} failed with exit code ${code}`);
          logger.npm.error('bundled npm command failed', { error: error.message });
          reject(error);
        }
      });

      child.on('error', (error) => {
        logger.npm.error('bundled npm error', { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Check if a command is a package manager command (npm, yarn, pnpm, npx)
   */
  static isPackageManagerCommand(command: string): boolean {
    return ['npm', 'npx', 'yarn', 'pnpm'].includes(command);
  }

  /**
   * Get the resolved npm path (system npm absolute path)
   * Returns null if using bundled npm or not yet resolved
   */
  getResolvedNpmPath(): string | null {
    return this.cachedNpmPath || null;
  }

  /**
   * Clear the npm info cache (useful for testing or if npm gets installed/uninstalled)
   */
  clearCache(): void {
    this.cachedNpmInfo = undefined;
    this.cachedNpmPath = undefined;
  }
}
