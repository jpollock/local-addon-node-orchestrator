# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-25

### Added

- **Public API** for programmatic access to Node.js orchestrator functionality
  - Export `NodeOrchestratorAPI` for use by other addons
  - Full TypeScript type definitions included
- **Bundled WordPress Plugin Support**
  - Auto-detect plugins in `wp-plugin/` directory of Node apps
  - Support for `.zip` file plugins with automatic extraction
  - WordPress.org plugin slugs support
  - Auto-installation and activation when sites start
- **Build Command Auto-Detection**
  - Automatically detect and run build commands from package.json
  - Support for `build`, `compile`, and `bundle` scripts
- **Configuration Schema**
  - `.nodeorchestrator.json` configuration file support
  - Zod schema validation for plugin configurations
  - Plugin metadata validation (headers, structure)

### Changed

- **Port Management**: Replaced custom port management with Local's built-in Ports service
- **WP-CLI Integration**: Now uses Local's built-in `wpCli` service instead of manual process spawning
- **Path Resolution**: Added tilde (`~`) path expansion for Local site paths
- **Entry Points**: Simplified build output with auto-generated entry points

### Fixed

- Duplicate app starts from multiple `siteStarted` hooks
- TypeScript compilation errors across the codebase
- Plugin activation timing (now waits for site to be running)
- Site path resolution for paths containing tilde

### Removed

- Subdirectory support for plugin installations (simplified to root-level only)
- Custom port allocation logic (now uses Local's Ports service)
- Redundant and unused files from previous architecture

## [1.0.0] - 2024-12-01

### Added

- Initial release
- Node.js application management for Local sites
- Process lifecycle management (start, stop, restart)
- Environment variable configuration
- WordPress environment variable injection
- Real-time log streaming
- Multiple apps per site support

---

[2.0.0]: https://github.com/getflywheel/local-addon-node-orchestrator/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/getflywheel/local-addon-node-orchestrator/releases/tag/v1.0.0
