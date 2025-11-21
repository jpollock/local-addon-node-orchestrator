/**
 * Zod validation schemas for IPC request data
 * Ensures all incoming data from renderer is properly validated
 */

import { z } from 'zod';

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
const nodeVersionSchema = z.enum(['18.x', '20.x', '21.x', '22.x']);

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
    branch: branchSchema,
    installCommand: autoDetectCommandSchema,
    buildCommand: optionalCommandSchema,
    startCommand: commandSchema,
    nodeVersion: nodeVersionSchema,
    autoStart: z.boolean(),
    env: envSchema.optional().default({})
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
  lines: z.number().int().positive().max(10000).optional().default(100)
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
