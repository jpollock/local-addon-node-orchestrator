/**
 * NpmManager - Smart npm detection and execution
 *
 * Provides hybrid npm support:
 * 1. Tries to use system npm when available (0 MB overhead, user's preferred version)
 * 2. Falls back to bundled npm when system npm not found (guaranteed to work)
 *
 * This ensures users don't need Node.js installed, but benefits from it when they do.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

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

  /**
   * Detect if system npm is available
   */
  private async detectSystemNpm(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('npm', ['--version'], {
        shell: true,
        timeout: 3000,
        stdio: 'pipe'
      });

      child.on('exit', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });

      child.on('timeout', () => {
        child.kill();
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
            console.warn('[NpmManager] Bundled npm not found at expected path:', npmCliPath);
            return null;
          }
        } catch (error) {
          // Invalid package.json, continue searching
        }
      }

      currentDir = path.dirname(currentDir);
      depth++;
    }

    console.warn('[NpmManager] Could not find addon root');
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

    if (hasSystemNpm) {
      console.log('[NpmManager] ✅ Using system npm');
      this.cachedNpmInfo = {
        type: 'system',
        path: 'npm'
      };
      return this.cachedNpmInfo;
    }

    // Fall back to bundled npm
    console.log('[NpmManager] System npm not found, checking bundled npm...');
    const bundledPath = this.getBundledNpmPath();

    if (bundledPath) {
      console.log('[NpmManager] ✅ Using bundled npm:', bundledPath);
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
   * Execute system npm command
   */
  private runSystemNpm(args: string[], options: NpmOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[NpmManager] Running system npm: npm ${args.join(' ')}`);

      const child = spawn('npm', args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env
        },
        shell: true,
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
          console.log(`[NpmManager] ✅ npm ${args[0]} completed successfully`);
          resolve();
        } else {
          const error = new Error(`npm ${args.join(' ')} failed with exit code ${code}`);
          console.error('[NpmManager] ❌', error.message);
          reject(error);
        }
      });

      child.on('error', (error) => {
        console.error('[NpmManager] ❌ npm error:', error);
        reject(error);
      });
    });
  }

  /**
   * Execute bundled npm command using Local's Node.js
   */
  private runBundledNpm(npmCliPath: string, args: string[], options: NpmOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[NpmManager] Running bundled npm: node ${npmCliPath} ${args.join(' ')}`);

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
          console.log(`[NpmManager] ✅ bundled npm ${args[0]} completed successfully`);
          resolve();
        } else {
          const error = new Error(`Bundled npm ${args.join(' ')} failed with exit code ${code}`);
          console.error('[NpmManager] ❌', error.message);
          reject(error);
        }
      });

      child.on('error', (error) => {
        console.error('[NpmManager] ❌ bundled npm error:', error);
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
   * Clear the npm info cache (useful for testing or if npm gets installed/uninstalled)
   */
  clearCache(): void {
    this.cachedNpmInfo = undefined;
  }
}
