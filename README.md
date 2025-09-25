# Local Node.js Orchestrator Addon

Manage Node.js applications alongside your WordPress sites in Local. Start, stop, and monitor Node.js apps from git repositories with your WordPress development.

## Features

- 🚀 **Git Integration** - Clone and manage Node.js apps from any git repository
- 🔄 **Lifecycle Management** - Apps start/stop automatically with your WordPress site
- 📦 **Dependency Management** - Automatic `npm install` on first run
- 🔧 **Environment Variables** - Configure env vars through Local's UI
- 📊 **Process Monitoring** - View logs, status, and resource usage
- 🌐 **Port Management** - Automatic port allocation and conflict resolution
- 🏃 **Multiple Runtimes** - Support for different Node.js versions per app
- 🔗 **WordPress Integration** - Access Node.js app URLs from WordPress

## Use Cases

- **Next.js/Gatsby Frontend** - Run headless WordPress with modern frontend
- **API Services** - Custom Node.js APIs alongside WordPress
- **Build Tools** - Webpack dev servers, asset compilation
- **Microservices** - Multiple Node.js services per site
- **WebSocket Servers** - Real-time features for WordPress
- **Queue Workers** - Background job processing

## Architecture

### Components

1. **Main Process**
   - Git repository management
   - Process lifecycle control
   - Environment configuration
   - Port allocation

2. **Lightning Service**
   - Node.js process management
   - Health monitoring
   - Log streaming
   - Restart on failure

3. **Renderer UI**
   - App configuration interface
   - Log viewer
   - Status monitoring
   - Environment variable editor

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

#### Main Process

- `node-orchestrator:add-app` - Add new Node.js app
- `node-orchestrator:remove-app` - Remove app
- `node-orchestrator:start-app` - Start specific app
- `node-orchestrator:stop-app` - Stop specific app
- `node-orchestrator:get-apps` - Get all apps for site
- `node-orchestrator:get-logs` - Get app logs
- `node-orchestrator:update-env` - Update environment variables

### Hooks

- `nodeAppStarting` - Before app starts
- `nodeAppStarted` - After app starts
- `nodeAppStopping` - Before app stops
- `nodeAppStopped` - After app stops
- `nodeAppError` - On app error

## Requirements

- Local 6.0+
- Git installed
- Node.js (managed by Local or system)

## License

MIT
