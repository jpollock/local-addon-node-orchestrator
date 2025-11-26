/**
 * Safe environment variable filtering
 *
 * Provides a filtered version of process.env that excludes
 * potentially sensitive variables (credentials, secrets, tokens)
 */

/**
 * Environment variables that should NOT be passed to child processes
 * These patterns match common secret/credential variable names
 */
const BLOCKED_ENV_PATTERNS = [
  /^(AWS_|AZURE_|GCP_|GOOGLE_)/i,           // Cloud provider credentials
  /(_KEY|_SECRET|_TOKEN|_PASSWORD|_CREDENTIAL)$/i, // Generic secrets
  /^(API_KEY|AUTH_TOKEN|SECRET_KEY|PRIVATE_KEY)/i, // Common secret names
  /^(DATABASE_URL|DB_PASSWORD|MONGO_URI)/i, // Database credentials
  /^(GITHUB_TOKEN|GITLAB_TOKEN|NPM_TOKEN)/i, // Service tokens
];

/**
 * Create a safe environment object by filtering out potentially sensitive variables
 * @returns Record of environment variables with secrets filtered out
 */
export function getSafeEnv(): Record<string, string> {
  const safeEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;

    // Check if this key matches any blocked pattern
    const isBlocked = BLOCKED_ENV_PATTERNS.some(pattern => pattern.test(key));
    if (!isBlocked) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}
