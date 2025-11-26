# Node.js Orchestrator - Context Document for AI Development

## Project Overview

**Name**: Node.js Orchestrator for Local by Flywheel
**Version**: 2.0.0
**Purpose**: Enable developers to run Node.js applications alongside WordPress sites in Local
**Current Branch**: `review-and-improve`
**Repository**: `/Users/jeremy.pollock/development/wpengine/local/addons/local-addon-node-orchestrator`

## What This Addon Does

The Node.js Orchestrator allows Local users to:
1. Clone Node.js apps from Git repositories
2. Install dependencies (npm/yarn/pnpm)
3. Build apps (if needed)
4. Start/stop Node.js apps alongside WordPress sites
5. Manage multiple Node.js apps per WordPress site
6. Configure environment variables
7. View logs
8. Auto-start apps when WordPress site starts

**Key Innovation**: Uses Local's bundled Node.js (via Electron) so users don't need Node.js installed on their system. Falls back to system npm when available for better performance.

## Current State (What's Been Completed)

### ✅ Phase 1: Core Functionality (v1.0.0)
- Git repository cloning with progress tracking
- npm/yarn/pnpm dependency installation
- Build command support
- Process spawning and lifecycle management
- Port allocation (3000-3999 range)
- Config persistence (JSON files per site)
- Basic UI with React createElement patterns

### ✅ Phase 2: Enhanced Features (v2.0.0)
- Port management with automatic allocation
- Clickable port links in UI
- Edit app configuration with pre-populated forms
- View logs in UI (last 100 lines)
- Environment variables editor
- Auto-refresh UI every 2 seconds
- Proper cleanup on site deletion

### ✅ Phase 3: Node.js Bundling (Latest)
- **Hybrid npm support**: System npm first, bundled npm fallback
- NpmManager class for smart npm detection
- Local's bundled Node.js via `process.execPath`
- `ELECTRON_RUN_AS_NODE='1'` environment variable
- Handles npm/yarn/pnpm/npx commands
- Debug flag: `FORCE_BUNDLED_NPM=true` for testing

## Architecture

### Technology Stack
- **TypeScript**: All source code in `src/`
- **Electron IPC**: Main process ↔ Renderer communication
- **React**: UI (using createElement, not JSX)
- **Local Components**: `@getflywheel/local-components`
- **Git**: `simple-git` library
- **Process Management**: Node.js `child_process.spawn()`
- **Validation**: Zod schemas
- **Logging**: Winston

### Directory Structure

```
local-addon-node-orchestrator/
├── src/
│   ├── main-full.ts              # Main process entry (IPC handlers, hooks)
│   ├── renderer.tsx              # UI components (React)
│   ├── types.ts                  # TypeScript interfaces
│   ├── lib/
│   │   ├── NodeAppManager.ts     # Core app lifecycle management
│   │   ├── GitManager.ts         # Git cloning with progress
│   │   ├── ConfigManager.ts      # JSON config persistence
│   │   ├── PortManager.ts        # Port allocation (3000-3999)
│   │   └── NpmManager.ts         # Hybrid npm support (NEW)
│   └── security/
│       ├── schemas.ts            # Zod validation schemas
│       ├── validation.ts         # Command validation
│       └── errors.ts             # Error sanitization
├── lib/                          # Compiled JavaScript (git-ignored)
├── package.json                  # Dependencies + npm@11.6.3
└── tsconfig.json                 # TypeScript config
```

### Key Classes

**NodeAppManager** (`src/lib/NodeAppManager.ts`)
- `addApp()`: Clone repo, install deps, build, save config
- `startApp()`: Spawn Node.js process, manage lifecycle
- `stopApp()`: Kill process gracefully (with tree-kill)
- `updateApp()`: Update configuration, restart if running
- `removeApp()`: Stop process, delete files, cleanup
- `getAppLogs()`: Read last N lines from log file

**GitManager** (`src/lib/GitManager.ts`)
- `cloneRepository()`: Clone with progress callbacks
- Uses `simple-git` library

**PortManager** (`src/lib/PortManager.ts`)
- `allocatePort()`: Find available port in 3000-3999 range
- `releasePort()`: Free up port when app removed
- Uses JSON file to track allocations per site

**ConfigManager** (`src/lib/ConfigManager.ts`)
- `loadApps()`: Read site's apps from JSON
- `saveApp()`: Persist app config
- `getApp()`: Get single app by ID
- Stores: `~/Local Sites/<site-name>/node-apps-config.json`

**NpmManager** (`src/lib/NpmManager.ts`) **[NEW]**
- `getNpmInfo()`: Detect system vs bundled npm
- `install()`: Run npm install
- `runCommand()`: Execute npm commands
- Smart detection with caching

### Data Model

**NodeApp Interface** (`src/types.ts`):
```typescript
interface NodeApp {
  id: string;                    // UUID
  name: string;                  // Slug (lowercase, dashes only)
  gitUrl: string;                // Git repository URL
  branch: string;                // Git branch
  installCommand: string;        // e.g., "npm install"
  buildCommand: string;          // e.g., "npm run build" (optional)
  startCommand: string;          // e.g., "npm start" or "node server.js"
  nodeVersion: string;           // Legacy (not used anymore)
  env: Record<string, string>;   // Environment variables
  status: 'stopped' | 'starting' | 'running' | 'error';
  autoStart: boolean;            // Start when site starts
  path: string;                  // Absolute path to app directory
  port: number;                  // Allocated port
  createdAt: Date;
  updatedAt?: Date;
}
```

### IPC Communication

**Handlers in `main-full.ts`**:
- `node-orchestrator:add-app`: Add new app
- `node-orchestrator:start-app`: Start app
- `node-orchestrator:stop-app`: Stop app
- `node-orchestrator:remove-app`: Remove app
- `node-orchestrator:get-apps`: Get all apps for site
- `node-orchestrator:get-logs`: Get app logs
- `node-orchestrator:update-env`: Update environment variables
- `node-orchestrator:update-app`: Update app configuration

**All requests validated with Zod schemas** before processing.

### Security Practices (CRITICAL)

1. **Input Validation**: All IPC requests validated with Zod schemas
2. **Command Sanitization**:
   - Commands split into `[command, ...args]`
   - `shell: false` for all spawn() calls (except system npm)
   - Whitelist of allowed commands
   - Max lengths enforced
3. **Path Validation**:
   - Site IDs validated
   - No path traversal allowed
   - Working directories verified to exist
4. **Error Sanitization**: Stack traces removed from user-facing errors
5. **Environment Variables**: Validated as key-value strings only

### Local Addon Patterns

**Important Local Concepts**:

1. **Hooks System**:
   - `siteStarted`: When WordPress site starts
   - `siteStopping`/`siteStopped`: When site stops
   - `siteDeleting`: When site deleted

2. **IPC System**:
   - Use `ipcMain.handle()` for async request/response
   - Return `{ success: boolean; data?: any; error?: string }`

3. **Service Container**:
   - `LocalMain.getServiceContainer().cradle`
   - Provides: `localLogger`, `siteData`

4. **Site Object**:
   ```typescript
   interface Site {
     id: string;              // Site ID (string, not UUID)
     name: string;            // Site name
     domain: string;          // e.g., "mysite.local"
     path: string;            // Absolute path to site
     services: {              // Enabled services
       [key: string]: {
         name: string;
         version: string;
         type: string;
       }
     }
   }
   ```

5. **File Locations**:
   - Sites: `~/Local Sites/<site-name>/`
   - Logs: `~/Local Sites/<site-name>/logs/`
   - Our apps: `~/Local Sites/<site-name>/app/node-apps/<app-id>/`
   - Our config: `~/Local Sites/<site-name>/node-apps-config.json`

6. **Electron/Node.js**:
   - `process.execPath`: Path to Electron executable
   - Set `ELECTRON_RUN_AS_NODE='1'` to run as Node.js
   - Main process has access to Node.js APIs
   - Renderer process is sandboxed

### Kitchen Sink Reference

Reference addon: `/Users/jeremy.pollock/development/wpengine/local/addons/local-addon-kitchen-sink`

**Key Learnings from Kitchen Sink**:
- Lightning Services use `process.execPath` + `ELECTRON_RUN_AS_NODE='1'`
- TypeScript requires `Object.defineProperty` for getters in constructors
- Kitchen Sink uses **system npm** for build, not bundled npm
- WP-CLI available at: `/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp`

## Development Environment

**Prerequisites**:
- Node.js installed locally (for development)
- Local by Flywheel installed
- TypeScript knowledge
- Git

**Development Workflow**:
```bash
# Install dependencies
npm install

# Build (compiles TypeScript to lib/)
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Link addon to Local
ln -sf $(pwd) ~/.config/Local/addons/local-addon-node-orchestrator

# Restart Local to load changes
# (or use watch mode + restart Local occasionally)
```

**Testing**:
- Manual testing in Local
- Test with real Git repos
- Test both system npm and bundled npm scenarios
- Use `FORCE_BUNDLED_NPM=true` to test bundled npm

## Git Workflow

**Branches**:
- `main`: Production-ready code
- `review-and-improve`: Active development branch (CURRENT)
- Feature branches: Created as needed, merged into `review-and-improve`

**Commit Messages**:
```
feat: Add new feature
fix: Bug fix
chore: Maintenance (version bump, deps)
docs: Documentation
refactor: Code restructuring
test: Add tests
```

Always include:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Common Pitfalls & Solutions

1. **Problem**: TypeScript "value never read" errors
   **Solution**: Import must be used, not just declared

2. **Problem**: Apps not starting
   **Solution**: Check logs in `~/Local Sites/<site>/logs/node-apps/<app-id>.log`

3. **Problem**: npm not found
   **Solution**: Either install Node.js or use bundled npm (should be automatic)

4. **Problem**: Port conflicts
   **Solution**: PortManager handles this, allocates 3000-3999 range

5. **Problem**: Site ID validation failing
   **Solution**: Local uses string site IDs, not UUIDs

6. **Problem**: Process keeps running after stop
   **Solution**: Using `tree-kill` to kill process tree

## Dependencies

**Production**:
- `@getflywheel/local-components@^16.0.0`: Local's UI components
- `fs-extra@^11.2.0`: Enhanced file system operations
- `npm@^11.6.3`: Bundled npm fallback (**18 MB**)
- `simple-git@^3.21.0`: Git operations
- `tree-kill@^1.2.2`: Kill process trees
- `uuid@^9.0.1`: Generate app IDs
- `winston@^3.11.0`: Logging
- `zod@^4.1.12`: Schema validation

**Dev Dependencies**:
- `@getflywheel/local@^6.0.0`: Local types
- `typescript@^5.3.3`: TypeScript compiler
- Jest, ESLint, etc.

## Performance Considerations

1. **Port Scanning**: Uses native Node.js, fast
2. **Git Cloning**: Progress callbacks prevent UI freeze
3. **Process Spawning**: `shell: false` for security AND performance
4. **UI Refresh**: Every 2 seconds (could be optimized with events)
5. **Log Reading**: Last N lines only (not entire file)

## Next Steps (Roadmap)

See `ROADMAP.md` for detailed feature plans.

**High Priority**:
1. WordPress environment variables auto-injection
2. WordPress plugin installation/activation
3. Monorepo support (subdirectory apps)

**Medium Priority**:
4. Modern React UI (proper JSX)
5. Real-time log streaming
6. Package.json script detection
7. Auto-restart on file changes

**Low Priority**:
8. Lightning Services integration
9. Multiple Node.js versions
10. Production mode

## Questions for AI Agents

When implementing features, ask yourself:

1. **Security**: Is user input validated? Are commands safe?
2. **Error Handling**: What if Git clone fails? npm install fails?
3. **User Experience**: Does UI show progress? Clear error messages?
4. **Performance**: Will this block the UI? Can it run async?
5. **Compatibility**: Works on Mac/Windows/Linux?
6. **Testing**: How do I test this? What edge cases exist?
7. **Documentation**: Are types clear? Comments helpful?
8. **Git Workflow**: Am I on the right branch? Commit message clear?

## Resources

- **Local SDK Docs**: https://github.com/getflywheel/local-addon-api
- **Kitchen Sink**: Reference implementation in same parent directory
- **Our Codebase**: Well-commented, follow existing patterns
- **Electron Docs**: https://www.electronjs.org/docs
- **Node.js Spawn**: https://nodejs.org/api/child_process.html

## Contact & Handoff

**Current State**:
- Working hybrid npm implementation
- All core features functional
- Ready for WordPress integration features

**Next Developer Should**:
1. Read this document thoroughly
2. Review `ROADMAP.md` for feature priorities
3. Check `DEVELOPMENT_GUIDELINES.md` for coding standards
4. Set up development environment
5. Test current functionality in Local
6. Start with highest priority roadmap item

**When Stuck**:
1. Check Kitchen Sink addon for reference
2. Review Local addon API documentation
3. Search existing code for similar patterns
4. Test in Local frequently
5. Read logs: `~/Local Sites/<site>/logs/`
