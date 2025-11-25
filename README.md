# Local Node.js Orchestrator Addon

Manage Node.js applications alongside your WordPress sites in Local. Start, stop, and monitor Node.js apps from git repositories with your WordPress development.

## 📚 Project Documentation

**New to the project?** Start here:
- **[INDEX.md](./INDEX.md)** - Complete documentation index (start here!)
- **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** - Developer quick reference
- **[EXECUTION_PLAN.md](./EXECUTION_PLAN.md)** - v3.0 development plan
- **[ROADMAP_VISUAL.md](./ROADMAP_VISUAL.md)** - Visual timeline and milestones

**Current Status**: v2.0.0 ✅ | **Next Milestone**: v2.1.0-beta.1 (WordPress Integration)

## Features

- 🚀 **Git Integration** - Clone and manage Node.js apps from any git repository
- 🔄 **Lifecycle Management** - Apps start/stop automatically with your WordPress site
- 📦 **Dependency Management** - Automatic `npm install` on first run
- 🔧 **Environment Variables** - Configure env vars through Local's UI
- 📊 **Process Monitoring** - View logs, status, and resource usage
- 🌐 **Port Management** - Automatic port allocation and conflict resolution
- 🏃 **Multiple Runtimes** - Support for different Node.js versions per app
- 🔗 **WordPress Integration** - Auto-inject WordPress DB credentials and URLs
- 🔌 **WordPress Plugin Support** - Bundle plugins with your Node app via .nodeorchestrator.json

## Use Cases

- **Next.js/Gatsby Frontend** - Run headless WordPress with modern frontend
- **API Services** - Custom Node.js APIs alongside WordPress
- **Build Tools** - Webpack dev servers, asset compilation
- **Microservices** - Multiple Node.js services per site
- **WebSocket Servers** - Real-time features for WordPress
- **Queue Workers** - Background job processing

## Architecture

### Security-First Design

This addon implements a **4-layer security architecture** to protect against common vulnerabilities:

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process (UI)                    │
│                  ↓ IPC Request (untrusted)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │  Layer 1: Input Validation (Zod)      │
         │  • Type checking                       │
         │  • Format validation                   │
         │  • Schema enforcement                  │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │  Layer 2: Command Validation           │
         │  • Whitelist checking                  │
         │  • Dangerous character blocking        │
         │  • Argument sanitization               │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │  Layer 3: Path Validation              │
         │  • Path traversal prevention           │
         │  • Null byte detection                 │
         │  • Boundary enforcement                │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │  Layer 4: Error Sanitization           │
         │  • Information leak prevention         │
         │  • Sensitive data removal              │
         │  • Safe client responses               │
         └────────────────────────────────────────┘
```

### Components

1. **Main Process** (src/main-full.ts)
   - IPC handler registration with validation
   - Git repository management
   - Process lifecycle control
   - Environment configuration
   - Port allocation

2. **Lightning Service** (src/services/NodeOrchestratorService.ts)
   - Secure Node.js process spawning
   - Health monitoring
   - Log streaming
   - Restart on failure
   - Resource management

3. **Renderer UI** (src/components/)
   - App configuration interface
   - Log viewer
   - Status monitoring
   - Environment variable editor

4. **Security Layer** (src/security/)
   - Input validation (schemas.ts)
   - Command validation (validation.ts)
   - Path validation (validation.ts)
   - Error sanitization (errors.ts)

### Data Structure

```typescript
interface NodeApp {
  id: string;
  name: string;
  gitUrl: string;
  branch: string;
  installCommand: string;  // npm install, yarn, pnpm install
  buildCommand?: string;   // npm run build
  startCommand: string;    // npm start, node index.js
  port?: number;          // Allocated port
  nodeVersion: string;    // 18.x, 20.x, etc.
  env: Record<string, string>;
  status: 'stopped' | 'installing' | 'building' | 'running' | 'error';
  autoStart: boolean;
  healthCheck?: {
    endpoint: string;     // /health
    interval: number;     // milliseconds
    timeout: number;      // milliseconds
  };
}

interface SiteNodeApps {
  siteId: string;
  apps: NodeApp[];
}
```

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Add to Local's addon directory

## Usage

1. **Add a Node.js App**
   - Open site in Local
   - Go to "Node.js Apps" tab
   - Click "Add App"
   - Enter git repository URL
   - Configure settings

2. **Start/Stop**
   - Apps start automatically with site
   - Or manually control from UI

3. **View Logs**
   - Click on app name
   - View real-time logs
   - Download log files

4. **Configure Environment**
   - Click "Environment" button
   - Add/edit variables
   - Changes require app restart

## 🔗 WordPress Integration (NEW!)

**This is the #1 distinguishing feature of this addon!** Seamlessly connect your Node.js apps to WordPress.

### Automatic WordPress Environment Variables

When you add a Node.js app, it automatically receives WordPress database credentials and configuration as environment variables:

```javascript
// In your Node.js app, these are automatically available:
process.env.WP_DB_HOST          // localhost:10006
process.env.WP_DB_NAME          // local
process.env.WP_DB_USER          // root
process.env.WP_DB_PASSWORD      // root
process.env.WP_SITE_URL         // http://mysite.local
process.env.WP_HOME_URL         // http://mysite.local
process.env.WP_ADMIN_URL        // http://mysite.local/wp-admin
process.env.WP_CONTENT_DIR      // /path/to/wp-content
process.env.WP_UPLOADS_DIR      // /path/to/wp-content/uploads
process.env.DATABASE_URL        // mysql://root:root@localhost:10006/local
```

### Example: Connect to WordPress Database

```javascript
// Express.js API that queries WordPress database
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.WP_DB_HOST.split(':')[0],
  port: process.env.WP_DB_HOST.split(':')[1] || 3306,
  user: process.env.WP_DB_USER,
  password: process.env.WP_DB_PASSWORD,
  database: process.env.WP_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

app.get('/api/posts', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM wp_posts WHERE post_status = ? ORDER BY post_date DESC LIMIT 10',
    ['publish']
  );
  res.json(rows);
});
```

### Example: Next.js with WordPress Backend

```javascript
// lib/wordpress.js
export async function getWordPressPosts() {
  const response = await fetch(`${process.env.WP_SITE_URL}/wp-json/wp/v2/posts`);
  return response.json();
}

// Also available: Direct database access via DATABASE_URL
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
```

### Toggle WordPress Integration

WordPress environment variables are injected by default, but you can disable it per-app:

```json
{
  "injectWpEnv": false
}
```

This is useful if:
- Your app doesn't need WordPress integration
- You want to manually configure database credentials
- You're connecting to a different WordPress site

### Security

**CRITICAL**: Database credentials are sensitive!

✅ **What we do**:
- Never log passwords in plain text
- Sanitize all error messages
- Use secure environment variable injection
- Follow principle of least privilege

❌ **What you should NOT do**:
- Don't expose credentials in client-side code
- Don't commit `.env` files with credentials
- Don't log `process.env` in production
- Don't share DATABASE_URL publicly

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

## Configuration

### Default Settings

```json
{
  "defaultNodeVersion": "20.x",
  "defaultInstallCommand": "npm install",
  "defaultStartCommand": "npm start",
  "healthCheckInterval": 30000,
  "maxRestarts": 3,
  "restartDelay": 5000
}
```

### Per-App Configuration

Each app can override defaults through:
- `.localrc.json` in repository root
- UI configuration
- Environment variables

## API

### IPC Channels

All IPC handlers follow this secure pattern:

```typescript
ipcMain.handle('node-orchestrator:action', async (_event, request: unknown) => {
  try {
    // 1. Validate input
    const validation = validate(RequestSchema, request);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // 2. Log with context
    localLogger.info('Action starting', { siteId, appId });

    // 3. Execute with validated data
    const result = await performAction(validation.data);

    // 4. Return success
    return { success: true, ...result };
  } catch (error: unknown) {
    // 5. Sanitize error
    const sanitizedError = logAndSanitizeError(localLogger, 'Action failed', error);
    return { success: false, error: sanitizedError };
  }
});
```

#### Available Channels

- **`node-orchestrator:add-app`** - Add new Node.js app
  - Request: `{ siteId: string, app: NodeAppConfig }`
  - Response: `{ success: boolean, app?: NodeApp, error?: string }`

- **`node-orchestrator:remove-app`** - Remove app
  - Request: `{ siteId: string, appId: string }`
  - Response: `{ success: boolean, error?: string }`

- **`node-orchestrator:start-app`** - Start specific app
  - Request: `{ siteId: string, appId: string }`
  - Response: `{ success: boolean, app?: NodeApp, error?: string }`

- **`node-orchestrator:stop-app`** - Stop specific app
  - Request: `{ siteId: string, appId: string }`
  - Response: `{ success: boolean, app?: NodeApp, error?: string }`

- **`node-orchestrator:get-apps`** - Get all apps for site
  - Request: `{ siteId: string }`
  - Response: `{ success: boolean, apps?: NodeApp[], error?: string }`

- **`node-orchestrator:get-logs`** - Get app logs
  - Request: `{ siteId: string, appId: string, lines?: number }`
  - Response: `{ success: boolean, logs?: string[], error?: string }`

- **`node-orchestrator:update-env`** - Update environment variables
  - Request: `{ siteId: string, appId: string, env: Record<string, string> }`
  - Response: `{ success: boolean, error?: string }`

### Hooks

- `nodeAppStarting` - Before app starts
- `nodeAppStarted` - After app starts
- `nodeAppStopping` - Before app stops
- `nodeAppStopped` - After app stops
- `nodeAppError` - On app error

## Security

### Input Validation

All IPC requests are validated using Zod schemas:

```typescript
// Request validation
const AddAppRequestSchema = z.object({
  siteId: z.string().uuid(),
  app: z.object({
    name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    gitUrl: z.string().url(),
    branch: z.string().min(1).max(100),
    installCommand: z.string().min(1).max(500),
    startCommand: z.string().min(1).max(500),
    nodeVersion: z.enum(['18.x', '20.x', '21.x', '22.x']),
    autoStart: z.boolean(),
    env: z.record(z.string(), z.string())
  })
});
```

### Command Validation

Only whitelisted commands and subcommands are allowed:

```typescript
// Allowed commands
AllowedCommands = {
  npm: ['start', 'run', 'install', 'build', 'test', 'dev', 'ci'],
  yarn: ['start', 'run', 'install', 'build', 'test', 'dev'],
  pnpm: ['start', 'run', 'install', 'build', 'test', 'dev'],
  node: true, // With script path validation
  bun: ['start', 'run', 'install', 'build', 'test', 'dev']
};

// Blocked dangerous characters: ; & | ` $ ( ) < > \ " '
```

### Path Traversal Prevention

All file paths are validated to prevent directory traversal:

```typescript
// Validate app paths
const pathValidation = validateAppPath(baseDirectory, appId);
if (!pathValidation.valid) {
  throw new Error('Invalid path');
}

// Use sanitized path
const safePath = pathValidation.sanitizedPath;
```

### Error Sanitization

Errors are sanitized before being sent to the renderer:

```typescript
// Server-side: Full error logged
logger.error('Operation failed', { error: error.stack });

// Client-side: Sanitized message
return { success: false, error: 'An error occurred' };
// Sensitive paths, env vars, and stack traces removed
```

### Secure Process Spawning

Processes are spawned with security best practices:

```typescript
const child = spawn(command, args, {
  cwd: validatedPath,
  env: sanitizedEnv,
  shell: false,        // Prevents shell injection
  detached: false
});
```

### Security Best Practices

1. **Never trust renderer input** - Always validate with Zod
2. **Use command whitelists** - Never allow arbitrary commands
3. **Validate all paths** - Prevent traversal attacks
4. **Sanitize errors** - Don't leak system information
5. **Use shell: false** - Prevent shell injection in spawn()
6. **Log full errors server-side** - Keep detailed logs for debugging
7. **Type request as unknown** - Force explicit validation

## Troubleshooting

### IPC Handler Not Found

**Problem**: "No handler registered for 'node-orchestrator:xxx'"

**Solution**: Ensure you're using `ipcMain.handle()` from 'electron':
```typescript
import { ipcMain } from 'electron';
ipcMain.handle('node-orchestrator:test', async (_event, request: unknown) => {
  // Handler code
});
```

### React Invalid Hook Call

**Problem**: "Invalid hook call" error in UI

**Solution**: Use class components instead of functional components with hooks:
```typescript
class MyComponent extends React.Component {
  state = { value: '' };
  render() { /* ... */ }
}
```

### Command Validation Failed

**Problem**: "Command contains dangerous characters" or "Executable not allowed"

**Solution**: Only use whitelisted commands:
- ✅ `npm start`, `yarn dev`, `node server.js`
- ❌ `npm start && rm -rf /`, `sh -c "command"`

### Path Validation Failed

**Problem**: "Path traversal detected" or "Invalid app path"

**Solution**: App IDs must be simple identifiers without path separators:
- ✅ `my-api-server`, `frontend-app`
- ❌ `../../../etc/passwd`, `/absolute/path`

## Requirements

- Local 6.0+
- Git installed
- Node.js (managed by Local or system)

## License

MIT
