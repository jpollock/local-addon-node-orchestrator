# Developer Guide

Technical documentation for developers who want to understand, modify, or extend the Node.js Orchestrator addon.

## Architecture Overview

The addon follows Local's standard two-process architecture with a security-first design:

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (UI)                    │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  renderer.tsx   │  │   React UI      │                   │
│  │  (entry point)  │  │  (components)   │                   │
│  └────────┬────────┘  └─────────────────┘                   │
│           │ IPC Request (untrusted)                         │
└───────────┼─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│         Layer 1: Input Validation (Zod Schemas)             │
│         • Type checking  • Format validation                │
└───────────┼─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│         Layer 2: Command Validation                          │
│         • Whitelist checking  • Dangerous char blocking     │
└───────────┼─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│         Layer 3: Path Validation                             │
│         • Path traversal prevention  • Symlink validation   │
└───────────┼─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Main Process                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  main-full.ts   │  │   Managers      │                   │
│  │  (IPC handlers) │  │  (business)     │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                             │
│           ▼                    ▼                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Git/npm/Process │  │  ConfigManager  │                   │
│  │   Operations    │  │   (persistence) │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│         Layer 4: Error Sanitization                          │
│         • Remove paths  • Strip stack traces                │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
local-addon-node-orchestrator/
├── package.json              # Addon manifest and dependencies
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Quick reference
├── CONTRIBUTING.md           # Contribution guidelines
├── docs/
│   ├── USER_GUIDE.md         # End-user documentation
│   ├── DEVELOPER_GUIDE.md    # This file
│   ├── TROUBLESHOOTING.md    # Common issues
│   └── assets/
│       └── demo.gif          # Demo animation
├── src/
│   ├── main-full.ts          # Main process entry point
│   ├── renderer.tsx          # Renderer entry point
│   ├── types.ts              # TypeScript interfaces (re-exports from library)
│   ├── constants.ts          # Application constants
│   ├── api/
│   │   ├── index.ts          # API exports
│   │   └── NodeOrchestratorAPI.ts  # IPC request handlers
│   ├── lib/
│   │   ├── NodeAppManager.ts # Core app lifecycle management
│   │   └── NpmManager.ts     # Hybrid npm support
│   ├── security/
│   │   ├── schemas.ts        # Zod validation schemas (imports from library)
│   │   └── errors.ts         # Error sanitization
│   └── __tests__/            # Test suites
│       ├── setup.ts          # Jest setup
│       ├── main.test.ts      # Main process tests
│       └── renderer.test.tsx # Renderer tests
├── tests/
│   └── __mocks__/            # Test mocks
└── lib/                      # Compiled JavaScript (git-ignored)
```

### Shared Library Dependency

This addon uses `@local-labs/local-addon-api` for shared functionality:

| Module | Provided By Library |
|--------|---------------------|
| GitManager | Git cloning with progress callbacks |
| ConfigManager | JSON config persistence |
| WordPressPluginManager | WordPress plugin installation |
| WordPressEnvManager | WP environment variable extraction |
| WpCliManager | WP-CLI command execution |
| BundledPluginDetector | Detect plugins in .nodeorchestrator.json |
| Logger | Winston-based logging with namespaces |
| Validation | Command/path validation utilities |

## Key Technical Patterns

### 1. Two-Process Architecture (Main/Renderer)

Local addons run in Electron's two-process model:

**Main Process** (`main-full.ts`):
- Has full Node.js API access
- Manages file system, processes, git
- Registers IPC handlers
- Responds to lifecycle hooks

**Renderer Process** (`renderer.tsx`):
- Runs in browser context
- Renders React UI
- Communicates via IPC only
- Cannot access Node.js APIs directly

```typescript
// Main process - IPC handler
ipcMain.handle('node-orchestrator:add-app', async (_event, request: unknown) => {
  const validation = validate(AddAppRequestSchema, request);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }
  // Process validated request
});

// Renderer process - IPC call
const response = await electron.ipcRenderer.invoke('node-orchestrator:add-app', {
  siteId: site.id,
  app: appConfig
});
```

### 2. IPC Communication Patterns

All IPC handlers follow this secure pattern:

```typescript
ipcMain.handle('node-orchestrator:action', async (_event, request: unknown) => {
  try {
    // 1. Validate input with Zod
    const validation = validate(ActionRequestSchema, request);
    if (!validation.success) {
      return { success: false, error: `Invalid request: ${validation.error}` };
    }

    // 2. Get site from siteData service
    const site = siteData.getSite(validation.data.siteId);
    if (!site) {
      throw new Error('Site not found');
    }

    // 3. Log action
    localLogger.info('Performing action', { siteId: validation.data.siteId });

    // 4. Execute validated operation
    const result = await manager.doAction(site, validation.data);

    // 5. Return success
    return { success: true, data: result };

  } catch (error: unknown) {
    // 6. Sanitize and return error
    const sanitizedError = logAndSanitizeError(localLogger, 'Action failed', error);
    return { success: false, error: sanitizedError };
  }
});
```

### 3. Security Validation Approach

**Input Validation (Zod)**:
```typescript
const AddAppRequestSchema = z.object({
  siteId: z.string().min(1).max(100),
  app: z.object({
    name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    gitUrl: z.string().url().max(500),
    branch: z.string().min(1).max(100),
    installCommand: z.string().min(1).max(500),
    startCommand: z.string().min(1).max(500)
  })
});
```

**Command Validation**:
```typescript
const AllowedCommands = {
  npm: ['start', 'run', 'install', 'build', 'test', 'dev', 'ci'],
  yarn: ['start', 'run', 'install', 'build', 'test', 'dev'],
  node: true  // With script path validation
};

// Blocked characters: ; & | ` $ ( ) < > \ " '
const dangerousChars = /[;&|`$()<>\\'\"]/;
```

**Path Validation**:
```typescript
function validatePath(basePath: string, targetPath: string): PathValidationResult {
  // Check for null bytes
  if (targetPath.includes('\0')) {
    return { valid: false, error: 'Null byte detected' };
  }

  // Resolve and check boundaries
  const fullPath = path.join(basePath, targetPath);
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(basePath);

  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    return { valid: false, error: 'Path traversal detected' };
  }

  // Check symlinks
  if (!isPathSafeFromSymlinks(resolvedPath, basePath)) {
    return { valid: false, error: 'Symlink escapes directory' };
  }

  return { valid: true, sanitizedPath: resolvedPath };
}
```

### 4. WordPress Integration Patterns

All WordPress integration is provided by the `@local-labs/local-addon-api` library.

**Environment Variable Injection**:
```typescript
import { WordPressEnvManager, getSafeEnv } from '@local-labs/local-addon-api';

// WordPressEnvManager extracts vars from wp-config.php
const wpEnv = await wordPressEnvManager.getWordPressEnvVars(site);

// Injected into Node.js process
const env = {
  ...getSafeEnv(),
  ...wpEnv,
  PORT: String(app.port)
};

spawn(command, args, { env, cwd: appPath, shell: false });
```

**WP-CLI Integration**:
```typescript
import { WpCliManager } from '@local-labs/local-addon-api';

// WpCliManager wraps Local's WP-CLI binary
const users = await wpCliManager.run(site, [
  'user', 'list',
  '--role=administrator',
  '--format=json'
]);
```

**Plugin Installation**:
```typescript
import {
  BundledPluginDetector,
  WordPressPluginManager
} from '@local-labs/local-addon-api';

// Detects plugins from .nodeorchestrator.json
const config = await bundledPluginDetector.detectPlugins(appPath);

for (const plugin of config.wpPlugins) {
  await wordPressPluginManager.installPlugin(site, plugin);
}
```

### 5. Hybrid npm Support

The NpmManager provides zero-dependency operation:

```typescript
async getNpmInfo(): Promise<NpmInfo> {
  // Try system npm first (better performance)
  const hasSystemNpm = await this.detectSystemNpm();
  if (hasSystemNpm && this.cachedNpmPath) {
    return { type: 'system', path: this.cachedNpmPath };
  }

  // Fall back to bundled npm (no Node.js required)
  const bundledPath = this.getBundledNpmPath();
  if (bundledPath) {
    return { type: 'bundled', path: bundledPath };
  }

  throw new Error('npm not found');
}

// Bundled npm uses Electron's Node.js
spawn(process.execPath, [npmCliPath, ...args], {
  env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
  shell: false
});
```

## Data Flow Diagrams

### Adding a Node.js App

```
User clicks "Add App"
       │
       ▼
Renderer: Collect form data
       │
       ▼
IPC: node-orchestrator:add-app
       │
       ▼
Main: Validate with Zod schema
       │
       ▼
Main: Validate command strings
       │
       ▼
GitManager: Clone repository
       │ (progress callbacks)
       ▼
NpmManager: Run install command
       │
       ▼
(Optional) Run build command
       │
       ▼
PortManager: Allocate port
       │
       ▼
ConfigManager: Save app config
       │
       ▼
WordPressEnvManager: Extract WP vars
       │
       ▼
BundledPluginDetector: Check for plugins
       │
       ▼
Return: { success: true, app }
```

### Starting an App

```
User clicks "Start" / Site starts
       │
       ▼
IPC: node-orchestrator:start-app
       │
       ▼
Main: Load app config
       │
       ▼
Main: Build environment vars
       │ (PORT, WP vars, custom vars)
       ▼
NodeAppManager: Spawn process
       │ (shell: false for security)
       ▼
Main: Pipe stdout/stderr to log file
       │
       ▼
Main: Update app status to 'running'
       │
       ▼
Return: { success: true, app }
```

## Key Discoveries & Gotchas

### Local Addon System

1. **Two Event Mechanisms**: Local has `HooksMain.doActions()` for addon hooks AND `sendIPCEvent()` for IPC. Some events only fire via IPC - use both patterns.

2. **Class Components Required**: Local's React environment doesn't support hooks. Use class components:
   ```typescript
   class MyComponent extends React.Component {
     state = { value: '' };
     render() { /* ... */ }
   }
   ```

3. **IPC site objects are serialized**: When receiving site data via IPC, fetch the full site from `siteData.getSite(siteId)` - the IPC version is missing methods.

4. **Apollo Cache Issues**: After updating site data, the UI may not refresh. Consider cache eviction patterns if needed.

### Security

1. **Always use `shell: false`**: Prevents command injection when spawning processes.

2. **Validate before use**: Never trust renderer input - validate everything with Zod first.

3. **Sanitize errors**: Remove paths and stack traces before sending to renderer.

4. **Check symlinks**: Path validation must follow symlinks to prevent escape attacks.

### npm/Node.js

1. **Bundled npm exists**: The addon includes npm as a dependency for zero-install scenarios.

2. **ELECTRON_RUN_AS_NODE**: Required when using Electron's Node.js to run npm.

3. **System npm is faster**: Prefer system npm when available.

### File System

1. **Config location**: `~/Local Sites/<site>/node-apps-config.json`
2. **App location**: `~/Local Sites/<site>/app/node-apps/<app-id>/`
3. **Logs location**: `~/Local Sites/<site>/logs/node-apps/<app-id>.log`

## How to Modify

### Add a New IPC Handler

1. Add schema in `src/security/schemas.ts`:
   ```typescript
   export const NewActionRequestSchema = z.object({
     siteId: siteIdSchema,
     // ... fields
   });
   ```

2. Add handler in `src/main-full.ts`:
   ```typescript
   ipcMain.handle('node-orchestrator:new-action', async (_event, request: unknown) => {
     const validation = validate(NewActionRequestSchema, request);
     // ... implementation
   });
   ```

3. Call from renderer:
   ```typescript
   const response = await electron.ipcRenderer.invoke('node-orchestrator:new-action', data);
   ```

### Add a New Manager Class

1. Create `src/lib/NewManager.ts`:
   ```typescript
   import { ConfigManager } from '@local-labs/local-addon-api';

   export class NewManager {
     constructor(private configManager: ConfigManager) {}

     async doSomething(params: ValidatedType): Promise<Result> {
       // Implementation
     }
   }
   ```

2. Instantiate in main and inject dependencies.

### Use WordPress Integration

WordPress features are provided by the `@local-labs/local-addon-api` library:

```typescript
import {
  WpCliManager,
  WordPressEnvManager,
  WordPressPluginManager,
  BundledPluginDetector
} from '@local-labs/local-addon-api';

// Run WP-CLI commands
const result = await wpCliManager.run(site, ['option', 'get', 'siteurl']);

// Get WordPress environment variables
const wpEnv = await wordPressEnvManager.getWordPressEnvVars(site);

// Install a WordPress plugin
await wordPressPluginManager.installPlugin(site, pluginConfig);
```

## Building & Testing

### Development Workflow

```bash
# Install dependencies
npm install

# Build (TypeScript to JavaScript)
npm run build

# Watch mode (auto-rebuild)
npm run watch

# Run tests
npm test

# Type checking only
npm run type-check

# Lint
npm run lint
```

### Testing

```bash
# All tests
npm test

# Unit tests only
npm test -- --testPathPattern=unit

# Integration tests only
npm test -- --testPathPattern=integration

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Manual Testing

1. Build the addon: `npm run build`
2. Symlink to Local's addons directory
3. Restart Local
4. Enable the addon in Local > Add-ons
5. Test with a running WordPress site

## Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `@local-labs/local-addon-api` | Shared library for Local addon utilities |
| `@getflywheel/local-components` | Local's UI components |
| `fs-extra` | Enhanced file operations |
| `npm` | Bundled npm fallback |
| `tree-kill` | Process tree termination |
| `uuid` | Generate app IDs |
| `zod` | Schema validation |

**Note**: Many utilities (GitManager, ConfigManager, logger, WordPress integration) are now provided by `@local-labs/local-addon-api`.

### Development

| Package | Purpose |
|---------|---------|
| `@getflywheel/local` | Local types |
| `typescript` | TypeScript compiler |
| `jest` | Testing framework |
| `eslint` | Code linting |

## Resources

- [Local Addon Documentation](https://localwp.com/help-docs/advanced/creating-add-ons/)
- [Kitchen Sink Reference Addon](https://github.com/getflywheel/local-addon-kitchen-sink)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Zod Documentation](https://zod.dev/)
