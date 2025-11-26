/**
 * Zod validation schemas for IPC request data
 * Ensures all incoming data from renderer is properly validated
 */

import { z } from 'zod';
import { PluginConfigSchema } from '../lib/schemas/nodeOrchestratorConfig';

/**
 * Site ID validation - Local uses string site IDs (not UUIDs)
 */
const siteIdSchema = z
  .string()
  .min(1, 'Site ID is required')
  .max(255, 'Site ID must be less than 255 characters');

/**
 * App ID validation - We generate these as UUIDs
 */
const appIdSchema = z.string().uuid('Invalid app ID format');

/**
 * App name validation - alphanumeric with dashes only
 */
const appNameSchema = z
  .string()
  .min(1, 'App name is required')
  .max(100, 'App name must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'App name must contain only lowercase letters, numbers, and dashes');

/**
 * Git URL validation
 */
const gitUrlSchema = z
  .string()
  .min(1, 'Git URL is required')
  .refine(
    (url) => {
      const patterns = [
        /^https?:\/\/.+$/,
        /^git@.+:.+$/,
        /^ssh:\/\/.+$/
      ];
      return patterns.some(pattern => pattern.test(url));
    },
    'Invalid Git URL format. Must be HTTPS, SSH, or git@ format'
  );

/**
 * Git branch validation
 */
const branchSchema = z
  .string()
  .min(1, 'Branch name is required')
  .max(100, 'Branch name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9/_.-]+$/, 'Branch name contains invalid characters');

/**
 * Command validation - checks for basic structure
 * More detailed validation is done by validateCommand()
 */
const commandSchema = z
  .string()
  .min(1, 'Command is required')
  .max(500, 'Command must be less than 500 characters');

/**
 * Optional command validation (can be empty string or omitted)
 */
const optionalCommandSchema = z
  .string()
  .max(500, 'Command must be less than 500 characters')
  .optional();

/**
 * Command that can be auto-detected (empty string allowed)
 */
const autoDetectCommandSchema = z
  .string()
  .max(500, 'Command must be less than 500 characters');

/**
 * Node version validation
 */
const nodeVersionSchema = z.enum(['18.x', '20.x', '21.x', '22.x']).default('20.x');

/**
 * Environment variables validation
 */
const envSchema = z.record(z.string(), z.string());

/**
 * Schema for adding a new app
 */
export const AddAppRequestSchema = z.object({
  siteId: siteIdSchema,
  app: z.object({
    name: appNameSchema,
    gitUrl: gitUrlSchema,
    branch: branchSchema.default('main'),
    installCommand: autoDetectCommandSchema.default(''),
    buildCommand: optionalCommandSchema,
    startCommand: commandSchema.default('npm start'),
    nodeVersion: nodeVersionSchema.optional(),
    autoStart: z.boolean().default(false),
    injectWpEnv: z.boolean().default(true), // Default to true - auto-inject WP env vars
    env: envSchema.default({})
  })
});

/**
 * Schema for starting an app
 */
export const StartAppRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema
});

/**
 * Schema for stopping an app
 */
export const StopAppRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema
});

/**
 * Schema for removing an app
 */
export const RemoveAppRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema
});

/**
 * Schema for getting apps
 */
export const GetAppsRequestSchema = z.object({
  siteId: siteIdSchema
});

/**
 * Schema for getting logs
 */
export const GetLogsRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema,
  lines: z.number().int().positive().max(10000).default(100)
});

/**
 * Schema for updating environment variables
 */
export const UpdateEnvRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema,
  env: envSchema
});

/**
 * Schema for updating an app's configuration
 */
export const UpdateAppRequestSchema = z.object({
  siteId: siteIdSchema,
  appId: appIdSchema,
  updates: z.object({
    name: appNameSchema.optional(),
    gitUrl: gitUrlSchema.optional(),
    branch: branchSchema.optional(),
    installCommand: autoDetectCommandSchema.optional(),
    buildCommand: optionalCommandSchema.optional(),
    startCommand: commandSchema.optional(),
    nodeVersion: nodeVersionSchema.optional(),
    autoStart: z.boolean().optional(),
    injectWpEnv: z.boolean().optional(),
    env: envSchema.optional()
  }).refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be updated'
  )
});

/**
 * Plugin ID validation - We generate these as UUIDs
 */
const pluginIdSchema = z.string().uuid('Invalid plugin ID format');

/**
 * Plugin name validation
 */
const pluginNameSchema = z
  .string()
  .min(1, 'Plugin name is required')
  .max(200, 'Plugin name must be less than 200 characters');

/**
 * Plugin slug validation - SECURITY CRITICAL
 * WordPress plugin slugs must be lowercase alphanumeric with hyphens and underscores only
 *
 * NOTE: This schema is currently unused as validation is now handled by PluginConfigSchema
 * Kept for potential future use or backward compatibility
 */
// const pluginSlugSchema = z
//   .string()
//   .min(1, 'Plugin slug is required')
//   .max(200, 'Plugin slug must be less than 200 characters')
//   .regex(/^[a-z0-9_-]+$/, 'Plugin slug must contain only lowercase letters, numbers, hyphens, and underscores')
//   .refine(
//     (slug) => {
//       // Block shell metacharacters
//       const shellMetaChars = /[;&|`$()<>\\'"]/;
//       if (shellMetaChars.test(slug)) {
//         return false;
//       }
//       // Block path traversal patterns
//       if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
//         return false;
//       }
//       return true;
//     },
//     'Plugin slug contains invalid or dangerous characters'
//   );

/**
 * Schema for installing a WordPress plugin
 */
export const InstallPluginRequestSchema = z.object({
  siteId: siteIdSchema,
  plugin: PluginConfigSchema.and(z.object({
    name: pluginNameSchema.optional()
  }))
});

/**
 * Schema for activating a plugin
 */
export const ActivatePluginRequestSchema = z.object({
  siteId: siteIdSchema,
  pluginId: pluginIdSchema
});

/**
 * Schema for deactivating a plugin
 */
export const DeactivatePluginRequestSchema = z.object({
  siteId: siteIdSchema,
  pluginId: pluginIdSchema
});

/**
 * Schema for removing a plugin
 */
export const RemovePluginRequestSchema = z.object({
  siteId: siteIdSchema,
  pluginId: pluginIdSchema
});

/**
 * Schema for getting plugins
 */
export const GetPluginsRequestSchema = z.object({
  siteId: siteIdSchema
});

/**
 * Helper function to validate data against a schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return {
        success: false,
        error: errorMessages
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}
