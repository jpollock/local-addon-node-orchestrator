/**
 * ZipPluginInstaller - Handle WordPress plugin installation from zip files
 * Supports both remote (https://) and local (file://) zip files
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as http from 'http';
import extract from 'extract-zip';

export interface ZipDownloadProgress {
  bytesDownloaded: number;
  totalBytes?: number;
  percentage?: number;
}

export interface ZipInstallResult {
  success: boolean;
  extractedPath: string;
  error?: string;
}

/**
 * ZipPluginInstaller
 * Downloads, extracts, and validates WordPress plugins from zip files
 */
export class ZipPluginInstaller {
  /**
   * Install a plugin from a zip file (https:// or file://)
   *
   * @param zipUrl - URL to zip file (https:// or file://)
   * @param targetPath - Where to extract the plugin
   * @param onProgress - Optional progress callback for downloads
   * @returns Install result with extracted path
   */
  async installFromZip(
    zipUrl: string,
    targetPath: string,
    onProgress?: (progress: ZipDownloadProgress) => void
  ): Promise<ZipInstallResult> {
    let tempZipPath: string | null = null;

    try {
      // Step 1: Get the zip file (download or read local)
      if (zipUrl.startsWith('https://') || zipUrl.startsWith('http://')) {
        tempZipPath = await this.downloadZip(zipUrl, onProgress);
      } else if (zipUrl.startsWith('file://')) {
        tempZipPath = this.parseFileUrl(zipUrl);

        // Validate local file exists
        if (!await fs.pathExists(tempZipPath)) {
          return {
            success: false,
            extractedPath: '',
            error: `Local zip file not found: ${tempZipPath}`
          };
        }
      } else {
        return {
          success: false,
          extractedPath: '',
          error: 'Zip URL must start with https:// or file://'
        };
      }

      // Step 2: Create temporary extraction directory
      const tempExtractDir = `${targetPath}-extract-temp`;
      await fs.ensureDir(tempExtractDir);

      // Step 3: Extract zip file
      await extract(tempZipPath, { dir: path.resolve(tempExtractDir) });

      // Step 4: Determine plugin structure
      const pluginDir = await this.findPluginDirectory(tempExtractDir);
      if (!pluginDir) {
        await fs.remove(tempExtractDir);
        return {
          success: false,
          extractedPath: '',
          error: 'No valid WordPress plugin found in zip file'
        };
      }

      // Step 5: Move plugin to final location
      await fs.ensureDir(path.dirname(targetPath));
      await fs.move(pluginDir, targetPath, { overwrite: false });

      // Step 6: Clean up
      await fs.remove(tempExtractDir);
      if (zipUrl.startsWith('https://') || zipUrl.startsWith('http://')) {
        await fs.remove(tempZipPath);
      }

      return {
        success: true,
        extractedPath: targetPath
      };

    } catch (error: any) {
      // Clean up on error
      if (tempZipPath && (zipUrl.startsWith('https://') || zipUrl.startsWith('http://'))) {
        try {
          await fs.remove(tempZipPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      return {
        success: false,
        extractedPath: '',
        error: this.sanitizeError(error)
      };
    }
  }

  /**
   * Download zip file from remote URL
   */
  private async downloadZip(
    url: string,
    onProgress?: (progress: ZipDownloadProgress) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.env.TMPDIR || '/tmp', 'node-orchestrator');
      fs.ensureDirSync(tempDir);

      const tempFilePath = path.join(tempDir, `plugin-${Date.now()}.zip`);
      const file = fs.createWriteStream(tempFilePath);

      const protocol = url.startsWith('https://') ? https : http;

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.removeSync(tempFilePath);
            this.downloadZip(redirectUrl, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        // Handle errors
        if (response.statusCode !== 200) {
          file.close();
          fs.removeSync(tempFilePath);
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;

          if (onProgress && totalBytes > 0) {
            onProgress({
              bytesDownloaded: downloadedBytes,
              totalBytes,
              percentage: Math.round((downloadedBytes / totalBytes) * 100)
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(tempFilePath);
        });
      });

      request.on('error', (error) => {
        file.close();
        fs.removeSync(tempFilePath);
        reject(error);
      });

      file.on('error', (error) => {
        file.close();
        fs.removeSync(tempFilePath);
        reject(error);
      });
    });
  }

  /**
   * Parse file:// URL to local filesystem path
   */
  private parseFileUrl(fileUrl: string): string {
    // Remove file:// prefix
    let filePath = fileUrl.substring(7);

    // Handle Windows paths (file:///C:/path)
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }

    return filePath;
  }

  /**
   * Find the actual plugin directory within extracted zip
   * Handles two structures:
   * 1. zip contains folder: plugin-name/plugin-files
   * 2. zip is plugin: plugin-files at root
   */
  private async findPluginDirectory(extractDir: string): Promise<string | null> {
    const entries = await fs.readdir(extractDir);

    // Case 1: Single directory at root (most common)
    if (entries.length === 1) {
      const singleEntry = path.join(extractDir, entries[0]);
      const stats = await fs.stat(singleEntry);

      if (stats.isDirectory()) {
        // Check if this directory has plugin headers
        if (await this.hasPluginHeaders(singleEntry)) {
          return singleEntry;
        }
      }
    }

    // Case 2: Plugin files at root of zip
    if (await this.hasPluginHeaders(extractDir)) {
      return extractDir;
    }

    // Case 3: Multiple directories - try to find one with plugin headers
    for (const entry of entries) {
      const entryPath = path.join(extractDir, entry);
      const stats = await fs.stat(entryPath);

      if (stats.isDirectory() && await this.hasPluginHeaders(entryPath)) {
        return entryPath;
      }
    }

    return null;
  }

  /**
   * Check if directory contains WordPress plugin headers
   */
  private async hasPluginHeaders(dir: string): Promise<boolean> {
    try {
      const files = await fs.readdir(dir);
      const phpFiles = files.filter(file => file.endsWith('.php'));

      for (const phpFile of phpFiles) {
        const filePath = path.join(dir, phpFile);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for WordPress plugin header
        const pluginHeaderPattern = /\/\*\*[\s\S]*?Plugin Name:\s*.+[\s\S]*?\*\//i;
        if (pluginHeaderPattern.test(content)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
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
}
