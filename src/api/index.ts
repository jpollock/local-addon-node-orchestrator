/**
 * Node Orchestrator Public API
 *
 * This module provides a programmatic interface for other Local addons
 * to manage Node.js applications and WordPress plugins.
 *
 * @packageDocumentation
 */

// Main API class
export { NodeOrchestratorAPI } from './NodeOrchestratorAPI';
export type { AddNodeAppConfig, ProgressCallback } from './NodeOrchestratorAPI';

// Core types
export type {
  NodeApp,
  NodeAppStatus,
  WordPressPlugin,
  PluginSource,
  PluginConfig,
  BundledPluginConfig,
  GitPluginConfig,
  ZipPluginConfig,
  WpOrgPluginConfig,
  NodeOrchestratorConfig
} from '../types';

// Progress types
export type { InstallProgress } from '../lib/NodeAppManager';
export type { PluginInstallProgress, GitProgressEvent } from '@local-labs/local-addon-api';
