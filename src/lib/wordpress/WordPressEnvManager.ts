/**
 * WordPressEnvManager - Extract WordPress environment variables from Local site
 *
 * This manager extracts database credentials, URLs, and paths from a Local WordPress site
 * and provides them as environment variables that can be injected into Node.js applications.
 *
 * CRITICAL SECURITY: This manager handles sensitive credentials. All logging MUST sanitize
 * database passwords and other sensitive data.
 */

import * as Local from '@getflywheel/local';
import * as path from 'path';

/**
 * WordPress environment variables extracted from Local site
 * These are injected into Node.js apps to enable WordPress integration
 */
export interface WordPressEnv {
  // Database credentials
  WP_DB_HOST: string;
  WP_DB_NAME: string;
  WP_DB_USER: string;
  WP_DB_PASSWORD: string;

  // Site URLs
  WP_SITE_URL: string;        // http://mysite.local
  WP_HOME_URL: string;         // http://mysite.local (WordPress home URL)
  WP_ADMIN_URL: string;        // http://mysite.local/wp-admin

  // File paths
  WP_CONTENT_DIR: string;      // Absolute path to wp-content
  WP_UPLOADS_DIR: string;      // Absolute path to wp-content/uploads

  // Optional: Full database connection string
  DATABASE_URL?: string;       // mysql://user:pass@host/dbname
}

/**
 * Type guard to check if site has required WordPress properties
 */
function hasWordPressConfig(site: any): site is Local.Site & {
  mysql?: { database?: string; user?: string; password?: string };
  domain?: string;
  paths?: { webRoot?: string };
} {
  return site && typeof site === 'object';
}

export class WordPressEnvManager {
  /**
   * Extract WordPress environment variables from a Local site
   *
   * @param site - Local.Site object
   * @returns WordPressEnv object with all environment variables
   * @throws {Error} If required site properties are missing
   *
   * @example
   * const wpEnv = WordPressEnvManager.extractWordPressEnv(site);
   * console.log(`Database: ${wpEnv.WP_DB_NAME}`);
   * console.log(`URL: ${wpEnv.WP_SITE_URL}`);
   */
  static extractWordPressEnv(site: Local.Site): WordPressEnv {
    if (!hasWordPressConfig(site)) {
      throw new Error('Invalid site object');
    }

    // Extract database credentials
    // Local stores these in site.mysql or site.services.mysql
    const dbHost = this.extractDatabaseHost(site);
    const dbName = this.extractDatabaseName(site);
    const dbUser = this.extractDatabaseUser(site);
    const dbPassword = this.extractDatabasePassword(site);

    // Extract site URLs
    const siteUrl = this.extractSiteUrl(site);
    const homeUrl = siteUrl; // In WordPress, these are typically the same
    const adminUrl = `${siteUrl}/wp-admin`;

    // Extract file paths
    const contentDir = this.extractContentDir(site);
    const uploadsDir = path.join(contentDir, 'uploads');

    // Build environment variables object
    const wpEnv: WordPressEnv = {
      WP_DB_HOST: dbHost,
      WP_DB_NAME: dbName,
      WP_DB_USER: dbUser,
      WP_DB_PASSWORD: dbPassword,
      WP_SITE_URL: siteUrl,
      WP_HOME_URL: homeUrl,
      WP_ADMIN_URL: adminUrl,
      WP_CONTENT_DIR: contentDir,
      WP_UPLOADS_DIR: uploadsDir
    };

    // Optional: Add full DATABASE_URL connection string
    // Format: mysql://user:password@host/database
    if (dbUser && dbPassword && dbHost && dbName) {
      wpEnv.DATABASE_URL = this.buildDatabaseUrl(dbUser, dbPassword, dbHost, dbName);
    }

    // Validate that we have all required fields
    this.validateWordPressEnv(wpEnv);

    return wpEnv;
  }

  /**
   * Extract database host from Local site
   * Local typically uses 'localhost' or '127.0.0.1' with a custom port
   */
  private static extractDatabaseHost(site: any): string {
    // Try various possible locations where Local might store DB host
    const host =
      site.mysql?.host ||
      site.services?.mysql?.host ||
      site.mysql?.ipAddress ||
      'localhost';

    // Local often includes port in host or as separate field
    const port =
      site.mysql?.port ||
      site.services?.mysql?.port;

    if (port && port !== 3306) {
      return `${host}:${port}`;
    }

    return host;
  }

  /**
   * Extract database name from Local site
   */
  private static extractDatabaseName(site: any): string {
    const dbName =
      site.mysql?.database ||
      site.services?.mysql?.database ||
      site.mysql?.dbName ||
      'local';

    if (!dbName) {
      throw new Error(`Unable to extract database name from site ${site.name || 'unknown'}`);
    }

    return dbName;
  }

  /**
   * Extract database user from Local site
   */
  private static extractDatabaseUser(site: any): string {
    const user =
      site.mysql?.user ||
      site.services?.mysql?.user ||
      site.mysql?.username ||
      'root';

    if (!user) {
      throw new Error(`Unable to extract database user from site ${site.name || 'unknown'}`);
    }

    return user;
  }

  /**
   * Extract database password from Local site
   * SECURITY: This is sensitive data - never log the actual password
   */
  private static extractDatabasePassword(site: any): string {
    const password =
      site.mysql?.password ||
      site.services?.mysql?.password ||
      site.mysql?.pass ||
      'root';

    if (!password) {
      throw new Error(`Unable to extract database password from site ${site.name || 'unknown'}`);
    }

    return password;
  }

  /**
   * Extract site URL from Local site
   */
  private static extractSiteUrl(site: any): string {
    // Local provides the domain
    const domain = site.domain || site.url;

    if (!domain) {
      throw new Error(`Unable to extract site URL from site ${site.name || 'unknown'}`);
    }

    // Local sites typically use http:// (not https://)
    // Check if domain already includes protocol
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }

    // Default to http://
    return `http://${domain}`;
  }

  /**
   * Extract wp-content directory path from Local site
   */
  private static extractContentDir(site: any): string {
    // Local provides the webRoot path (usually app/public)
    const webRoot =
      site.paths?.webRoot ||
      site.path ||
      '';

    if (!webRoot) {
      throw new Error(`Unable to extract web root from site ${site.name || 'unknown'}`);
    }

    // wp-content is typically at webRoot/wp-content
    return path.join(webRoot, 'wp-content');
  }

  /**
   * Build DATABASE_URL connection string
   * Format: mysql://user:password@host/database
   *
   * SECURITY: This contains the password, so it must be treated as sensitive
   */
  private static buildDatabaseUrl(user: string, password: string, host: string, database: string): string {
    // URL-encode the password to handle special characters
    const encodedPassword = encodeURIComponent(password);
    const encodedUser = encodeURIComponent(user);

    return `mysql://${encodedUser}:${encodedPassword}@${host}/${database}`;
  }

  /**
   * Validate that all required WordPress environment variables are present
   * @throws {Error} If any required field is missing or empty
   */
  private static validateWordPressEnv(wpEnv: WordPressEnv): void {
    const required: (keyof Omit<WordPressEnv, 'DATABASE_URL'>)[] = [
      'WP_DB_HOST',
      'WP_DB_NAME',
      'WP_DB_USER',
      'WP_DB_PASSWORD',
      'WP_SITE_URL',
      'WP_HOME_URL',
      'WP_ADMIN_URL',
      'WP_CONTENT_DIR',
      'WP_UPLOADS_DIR'
    ];

    const missing: string[] = [];

    for (const field of required) {
      if (!wpEnv[field] || wpEnv[field].trim() === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required WordPress environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Sanitize WordPress environment for logging
   * SECURITY CRITICAL: Removes passwords and other sensitive data
   *
   * @param wpEnv - WordPress environment object
   * @returns Sanitized object safe for logging
   *
   * @example
   * const wpEnv = WordPressEnvManager.extractWordPressEnv(site);
   * const safe = WordPressEnvManager.sanitizeForLogging(wpEnv);
   * console.log('WP Env:', safe); // Password is masked
   */
  static sanitizeForLogging(wpEnv: WordPressEnv): Partial<WordPressEnv> {
    return {
      WP_DB_HOST: wpEnv.WP_DB_HOST,
      WP_DB_NAME: wpEnv.WP_DB_NAME,
      WP_DB_USER: wpEnv.WP_DB_USER,
      WP_DB_PASSWORD: '***REDACTED***',
      WP_SITE_URL: wpEnv.WP_SITE_URL,
      WP_HOME_URL: wpEnv.WP_HOME_URL,
      WP_ADMIN_URL: wpEnv.WP_ADMIN_URL,
      WP_CONTENT_DIR: wpEnv.WP_CONTENT_DIR,
      WP_UPLOADS_DIR: wpEnv.WP_UPLOADS_DIR,
      DATABASE_URL: wpEnv.DATABASE_URL ? 'mysql://***REDACTED***' : undefined
    };
  }

  /**
   * Check if WordPress environment injection is available for a site
   * This is a lightweight check to see if we can extract WP env vars
   *
   * @param site - Local.Site object
   * @returns true if WordPress environment can be extracted
   */
  static canExtractWordPressEnv(site: Local.Site): boolean {
    try {
      this.extractWordPressEnv(site);
      return true;
    } catch (error) {
      return false;
    }
  }
}
