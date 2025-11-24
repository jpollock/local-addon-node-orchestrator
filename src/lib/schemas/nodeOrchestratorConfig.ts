/**
 * Zod schema for .nodeorchestrator.json configuration file
 * Validates plugin definitions and node app settings
 */

import { z } from 'zod';

/**
 * Base plugin configuration (common fields)
 */
const BasePluginConfigSchema = z.object({
  slug: z.string()
    .min(1, 'Plugin slug is required')
    .max(200, 'Plugin slug too long')
    .regex(/^[a-z0-9_-]+$/, 'Plugin slug must contain only lowercase letters, numbers, hyphens, and underscores'),
  autoActivate: z.boolean().optional().default(false),
});

/**
 * Bundled plugin (path within repository)
 */
const BundledPluginConfigSchema = BasePluginConfigSchema.extend({
  source: z.literal('bundled'),
  path: z.string().min(1, 'Plugin path is required'),
});

/**
 * Git-based plugin (clone from repository)
 */
const GitPluginConfigSchema = BasePluginConfigSchema.extend({
  source: z.literal('git'),
  url: z.string().url('Invalid Git URL'),
  branch: z.string().min(1, 'Branch name is required').default('main'),
  subdirectory: z.string().optional(),
});

/**
 * Zip file plugin (local or remote)
 */
const ZipPluginConfigSchema = BasePluginConfigSchema.extend({
  source: z.literal('zip'),
  url: z.string().min(1, 'Zip URL is required')
    .refine(
      (url) => url.startsWith('https://') || url.startsWith('file://'),
      'Zip URL must start with https:// or file://'
    ),
  checksum: z.string().optional(), // Optional SHA256 checksum for verification
});

/**
 * WP.org plugin (install from WordPress.org)
 */
const WpOrgPluginConfigSchema = BasePluginConfigSchema.extend({
  source: z.literal('wporg'),
  version: z.string().optional(), // Optional version constraint
});

/**
 * Discriminated union of all plugin config types
 */
export const PluginConfigSchema = z.discriminatedUnion('source', [
  BundledPluginConfigSchema,
  GitPluginConfigSchema,
  ZipPluginConfigSchema,
  WpOrgPluginConfigSchema,
]);

/**
 * Node app configuration section
 */
const NodeConfigSchema = z.object({
  subdirectory: z.string().optional(),
  startCommand: z.string().optional(),
  autoStart: z.boolean().optional().default(false),
  port: z.number().int().min(1024).max(65535).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

/**
 * WordPress configuration section
 */
const WordPressConfigSchema = z.object({
  plugins: z.array(PluginConfigSchema).optional().default([]),
});

/**
 * Root configuration schema
 */
export const NodeOrchestratorConfigSchema = z.object({
  $schema: z.string().optional(), // Allow JSON schema reference
  wordpress: WordPressConfigSchema.optional(),
  node: NodeConfigSchema.optional(),
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type BundledPluginConfig = z.infer<typeof BundledPluginConfigSchema>;
export type GitPluginConfig = z.infer<typeof GitPluginConfigSchema>;
export type ZipPluginConfig = z.infer<typeof ZipPluginConfigSchema>;
export type WpOrgPluginConfig = z.infer<typeof WpOrgPluginConfigSchema>;
export type NodeConfig = z.infer<typeof NodeConfigSchema>;
export type WordPressConfig = z.infer<typeof WordPressConfigSchema>;
export type NodeOrchestratorConfig = z.infer<typeof NodeOrchestratorConfigSchema>;
