/**
 * GitManager - Secure Git repository operations
 * Handles cloning, updating, and validating Git repositories
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface GitCloneOptions {
  url: string;
  branch: string;
  targetPath: string;
  subdirectory?: string;
  requirePackageJson?: boolean; // Default true for Node.js apps, false for WordPress plugins
  onProgress?: (event: GitProgressEvent) => void;
}

export interface GitProgressEvent {
  phase: 'cloning' | 'resolving' | 'receiving' | 'checking-out' | 'complete';
  progress: number; // 0-100
  message: string;
}

export interface GitCloneResult {
  success: boolean;
  path: string;
  error?: string;
}

export class GitManager {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  /**
   * Clone a Git repository with security validation
   *
   * @param options - Clone options with URL, branch, and target path
   * @returns Promise resolving to clone result
   */
  async cloneRepository(options: GitCloneOptions): Promise<GitCloneResult> {
    const { url, branch, targetPath, onProgress } = options;

    try {
      // Validate Git URL
      if (!this.isValidGitUrl(url)) {
        return {
          success: false,
          path: '',
          error: 'Invalid Git URL format. Must be https://, git@, or ssh://'
        };
      }

      // Validate branch name
      if (!this.isValidBranchName(branch)) {
        return {
          success: false,
          path: '',
          error: 'Invalid branch name. Cannot contain special characters that could enable shell injection'
        };
      }

      // Ensure target directory doesn't exist
      if (await fs.pathExists(targetPath)) {
        return {
          success: false,
          path: '',
          error: 'Target directory already exists'
        };
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(targetPath);
      await fs.ensureDir(parentDir);

      // Report initial progress
      if (onProgress) {
        onProgress({
          phase: 'cloning',
          progress: 0,
          message: 'Starting clone operation...'
        });
      }

      // Clone the repository
      // Note: simple-git doesn't provide easy progress tracking in v3.x
      // We'll just report start and completion
      await this.git.clone(
        url,
        targetPath,
        [
          '--branch', branch,
          '--single-branch',
          '--depth', '1' // Shallow clone for faster operations
        ]
      );

      // If subdirectory is specified, verify it exists and is safe
      let workingPath = targetPath;
      if (options.subdirectory) {
        // Construct subdirectory path
        const subdirPath = path.join(targetPath, options.subdirectory);

        // SECURITY: Verify subdirectory is within cloned repo (prevent traversal)
        const resolvedSubdir = path.resolve(subdirPath);
        const resolvedTarget = path.resolve(targetPath);
        if (!resolvedSubdir.startsWith(resolvedTarget)) {
          // Clean up the cloned directory
          await fs.remove(targetPath);
          return {
            success: false,
            path: '',
            error: 'Path traversal detected in subdirectory path'
          };
        }

        // Verify subdirectory exists
        if (!await fs.pathExists(subdirPath)) {
          // Clean up the cloned directory
          await fs.remove(targetPath);
          return {
            success: false,
            path: '',
            error: `Subdirectory not found: ${options.subdirectory}`
          };
        }

        // Verify subdirectory is actually a directory
        const stats = await fs.stat(subdirPath);
        if (!stats.isDirectory()) {
          // Clean up the cloned directory
          await fs.remove(targetPath);
          return {
            success: false,
            path: '',
            error: `Subdirectory path is not a directory: ${options.subdirectory}`
          };
        }

        // Use subdirectory as working path for package.json check
        workingPath = subdirPath;
      }

      // Verify package.json exists in working path (only for Node.js apps)
      // WordPress plugins don't need package.json
      const requirePackageJson = options.requirePackageJson ?? true; // Default to true for backward compatibility
      if (requirePackageJson) {
        const packageJsonPath = path.join(workingPath, 'package.json');
        if (!await fs.pathExists(packageJsonPath)) {
          // Clean up the cloned directory
          await fs.remove(targetPath);
          const location = options.subdirectory
            ? `subdirectory "${options.subdirectory}"`
            : 'repository root';
          return {
            success: false,
            path: '',
            error: `No package.json found in ${location}`
          };
        }
      }

      // Report completion
      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          message: 'Clone complete'
        });
      }

      return {
        success: true,
        path: targetPath
      };

    } catch (error: any) {
      // Clean up on error
      try {
        if (await fs.pathExists(targetPath)) {
          await fs.remove(targetPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: false,
        path: '',
        error: this.sanitizeGitError(error)
      };
    }
  }

  /**
   * Validate Git URL format
   * Allows: https://, git@, ssh://
   * Blocks: file://, malicious URLs
   */
  private isValidGitUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Allow common Git URL formats
    const validPatterns = [
      /^https:\/\/.+\.git$/i,        // https://github.com/user/repo.git
      /^https:\/\/.+$/i,             // https://github.com/user/repo
      /^git@.+:.+\.git$/i,           // git@github.com:user/repo.git
      /^git@.+:.+$/i,                // git@github.com:user/repo
      /^ssh:\/\/.+\.git$/i,          // ssh://git@github.com/user/repo.git
      /^ssh:\/\/.+$/i                // ssh://git@github.com/user/repo
    ];

    // Check if URL matches any valid pattern
    const isValid = validPatterns.some(pattern => pattern.test(url));
    if (!isValid) {
      return false;
    }

    // Block file:// URLs and other potentially dangerous protocols
    const dangerousPatterns = [
      /^file:/i,
      /^javascript:/i,
      /^data:/i,
      /^\//,  // Absolute paths
      /^\.\./, // Relative paths with traversal
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(url));
    if (isDangerous) {
      return false;
    }

    // Block URLs with shell metacharacters
    const shellMetaChars = /[;&|`$()<>\\'"]/;
    if (shellMetaChars.test(url)) {
      return false;
    }

    return true;
  }

  /**
   * Validate Git branch name
   * Blocks shell metacharacters that could enable command injection
   */
  private isValidBranchName(branch: string): boolean {
    if (!branch || typeof branch !== 'string') {
      return false;
    }

    // Branch name length check
    if (branch.length === 0 || branch.length > 200) {
      return false;
    }

    // Allow alphanumeric, hyphens, underscores, slashes, and dots
    // This matches standard Git branch naming conventions
    const validBranchPattern = /^[a-zA-Z0-9/_.-]+$/;
    if (!validBranchPattern.test(branch)) {
      return false;
    }

    // Block shell metacharacters
    const shellMetaChars = /[;&|`$()<>\\'"]/;
    if (shellMetaChars.test(branch)) {
      return false;
    }

    // Block branch names that start with special characters
    if (branch.startsWith('.') || branch.startsWith('/') || branch.startsWith('-')) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize Git error messages to remove sensitive information
   */
  private sanitizeGitError(error: any): string {
    if (!error) {
      return 'Unknown Git error occurred';
    }

    let message = error.message || String(error);

    // Remove user paths
    message = message.replace(/\/Users\/[^/\s]+/g, '[USER]');
    message = message.replace(/\/home\/[^/\s]+/g, '[USER]');
    message = message.replace(/C:\\Users\\[^\\s]+/g, '[USER]');

    // Remove credentials if accidentally included
    message = message.replace(/:[^:@]+@/g, ':[REDACTED]@');
    message = message.replace(/token=[^&\s]+/g, 'token=[REDACTED]');

    // Common Git error messages to user-friendly messages
    if (message.includes('not found') || message.includes('Could not resolve host')) {
      return 'Repository not found or network error';
    }

    if (message.includes('authentication') || message.includes('Permission denied')) {
      return 'Authentication failed. Check credentials or use HTTPS URL';
    }

    if (message.includes('already exists')) {
      return 'Target directory already exists';
    }

    // Return sanitized message
    return `Git operation failed: ${message}`;
  }

  /**
   * Get the current branch of a repository
   */
  async getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
      const git = simpleGit(repoPath);
      const branch = await git.branch();
      return branch.current;
    } catch (error) {
      return null;
    }
  }

  /**
   * Pull latest changes from remote
   */
  async pullLatest(repoPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const git = simpleGit(repoPath);
      await git.pull();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: this.sanitizeGitError(error)
      };
    }
  }

  /**
   * Check if path is a Git repository
   */
  async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      const git = simpleGit(repoPath);
      await git.status();
      return true;
    } catch (error) {
      return false;
    }
  }
}
