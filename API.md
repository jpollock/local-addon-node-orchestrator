# Node Orchestrator Public API

The Node Orchestrator addon provides a public API for programmatic access by other Local addons. This allows you to manage Node.js applications and WordPress plugins without requiring user interaction through the UI.

## Installation

To use the API in your addon, add Node Orchestrator as a dependency:

```json
{
  "dependencies": {
    "@local/node-orchestrator": "^2.0.0"
  }
}
```

## Basic Usage

```typescript
import { NodeOrchestratorAPI } from '@local/node-orchestrator/api';
import * as Local from '@getflywheel/local';

// In your addon's main process
export default function (context: Local.AddonMainContext): void {
  const { siteData } = Local.getServiceContainer().cradle;

  // Get a site
  const site = siteData.getSite('your-site-id');

  // Create API instance
  const orchestrator = new NodeOrchestratorAPI(site);

  // Use the API
  await orchestrator.addNodeApp({
    name: 'my-api',
    gitUrl: 'https://github.com/org/repo.git',
    autoStart: true
  });
}
```

## API Reference

### NodeOrchestratorAPI

The main entry point for all operations.

#### Constructor

```typescript
new NodeOrchestratorAPI(site: Local.Site)
```

Creates a new API instance for the given Local site.

**Parameters:**
- `site`: Local.Site object from Local's siteData service

---

### Node.js Application Management

#### addNodeApp()

Add a Node.js application to the site from a Git repository.

```typescript
async addNodeApp(
  config: AddNodeAppConfig,
  onProgress?: ProgressCallback
): Promise<NodeApp>
```

**Parameters:**
- `config.name` (required): Application name
- `config.gitUrl` (required): Git repository URL
- `config.branch` (optional): Git branch (default: 'main')
- `config.installCommand` (optional): Install command (auto-detected if not provided)
- `config.buildCommand` (optional): Build command
- `config.startCommand` (optional): Start command (default: 'npm start')
- `config.nodeVersion` (optional): Node version (default: '20.x')
- `config.env` (optional): Custom environment variables
- `config.autoStart` (optional): Auto-start with site (default: false)
- `config.injectWpEnv` (optional): Auto-inject WordPress env vars (default: true)
- `onProgress` (optional): Progress callback function

**Note:** Repository must have `package.json` at root. Monorepo/subdirectory support has been removed for simplicity.

**Returns:** Promise<NodeApp> - The created application

**Example:**

```typescript
const app = await orchestrator.addNodeApp({
  name: 'my-api',
  gitUrl: 'https://github.com/org/my-api.git',
  branch: 'develop',
  autoStart: true,
  env: {
    API_KEY: 'dev-key-123',
    DEBUG: 'true'
  }
}, (progress) => {
  console.log(`${progress.phase}: ${progress.message} (${progress.progress}%)`);
});
```

#### startApp()

Start a Node.js application.

```typescript
async startApp(appId: string): Promise<void>
```

#### stopApp()

Stop a Node.js application.

```typescript
async stopApp(appId: string): Promise<void>
```

#### removeApp()

Remove a Node.js application and all its files.

```typescript
async removeApp(appId: string): Promise<void>
```

#### getApps()

Get all Node.js applications for the site.

```typescript
async getApps(): Promise<NodeApp[]>
```

#### getApp()

Get a specific Node.js application.

```typescript
async getApp(appId: string): Promise<NodeApp | null>
```

#### updateAppEnv()

Update environment variables for an application.

```typescript
async updateAppEnv(appId: string, env: Record<string, string>): Promise<NodeApp>
```

---

### WordPress Plugin Management

#### addPlugin()

Install a WordPress plugin from various sources.

```typescript
async addPlugin(
  config: PluginConfig & { name?: string },
  onProgress?: (event: PluginInstallProgress) => void
): Promise<WordPressPlugin>
```

**Plugin Sources:**

##### From WordPress.org

```typescript
const plugin = await orchestrator.addPlugin({
  source: 'wporg',
  slug: 'wp-graphql',
  autoActivate: true
});
```

##### From Git Repository

```typescript
const plugin = await orchestrator.addPlugin({
  source: 'git',
  url: 'https://github.com/org/plugin.git',
  branch: 'main',
  slug: 'my-plugin',
  autoActivate: true
});
```

**Note:** Plugin must be at repository root. Monorepo support has been removed for simplicity.

##### From Zip File (Remote)

```typescript
const plugin = await orchestrator.addPlugin({
  source: 'zip',
  url: 'https://example.com/plugins/premium-plugin.zip',
  slug: 'premium-plugin',
  autoActivate: false
});
```

##### From Zip File (Local)

```typescript
const plugin = await orchestrator.addPlugin({
  source: 'zip',
  url: 'file:///path/to/plugin.zip',
  slug: 'local-plugin',
  autoActivate: true
});
```

##### Bundled with Node App

Bundled plugins are auto-detected and installed when you add a Node app. They don't need to be manually installed via this method.

#### activatePlugin()

Activate a WordPress plugin.

```typescript
async activatePlugin(slug: string): Promise<void>
```

#### deactivatePlugin()

Deactivate a WordPress plugin.

```typescript
async deactivatePlugin(slug: string): Promise<void>
```

#### removePlugin()

Remove a WordPress plugin.

```typescript
async removePlugin(slug: string): Promise<void>
```

#### getPlugins()

Get all WordPress plugins managed by Node Orchestrator.

```typescript
async getPlugins(): Promise<WordPressPlugin[]>
```

#### getPlugin()

Get a specific WordPress plugin.

```typescript
async getPlugin(pluginId: string): Promise<WordPressPlugin | null>
```

---

## Advanced Usage

### Hardcoded/Preset Configuration

Create a "hardcoded" addon that automatically sets up a specific Node app configuration:

```typescript
import { NodeOrchestratorAPI } from '@local/node-orchestrator/api';

export default function (context: Local.AddonMainContext): void {
  const { siteData } = Local.getServiceContainer().cradle;

  // Hook into site creation
  context.hooks.addAction('siteAdded', async (site: Local.Site) => {
    const orchestrator = new NodeOrchestratorAPI(site);

    try {
      // Automatically add your company's standard stack
      await orchestrator.addNodeApp({
        name: 'company-api',
        gitUrl: 'https://github.com/company/api.git',
        branch: 'main',
        autoStart: true,
        env: {
          COMPANY_ENV: 'development'
        }
      });

      // Install required plugins
      await orchestrator.addPlugin({
        source: 'wporg',
        slug: 'wp-graphql',
        autoActivate: true
      });

      console.log('Company stack installed successfully!');
    } catch (error) {
      console.error('Failed to install company stack:', error);
    }
  });
}
```

### Progress Tracking

Monitor installation progress in real-time:

```typescript
await orchestrator.addNodeApp({
  name: 'my-app',
  gitUrl: 'https://github.com/org/repo.git'
}, (progress) => {
  switch (progress.phase) {
    case 'cloning':
      console.log(`Cloning repository: ${progress.progress}%`);
      break;
    case 'installing':
      console.log(`Installing dependencies: ${progress.progress}%`);
      break;
    case 'building':
      console.log(`Building application: ${progress.progress}%`);
      break;
    case 'installing-plugins':
      console.log(`Installing bundled plugins: ${progress.message}`);
      break;
    case 'complete':
      console.log('Installation complete!');
      break;
  }
});
```

### Error Handling

```typescript
try {
  const app = await orchestrator.addNodeApp({
    name: 'my-app',
    gitUrl: 'https://github.com/org/repo.git'
  });

  console.log(`App installed: ${app.id}`);
} catch (error) {
  console.error('Installation failed:', error.message);
  // Handle error appropriately
}
```

---

## Configuration File (.nodeorchestrator.json)

When adding a Node app, the system automatically detects and installs bundled WordPress plugins if a `.nodeorchestrator.json` file is present in the repository root.

### Example Configuration

```json
{
  "wordpress": {
    "plugins": [
      {
        "source": "bundled",
        "path": "wp-plugin",
        "slug": "my-custom-plugin",
        "autoActivate": true
      },
      {
        "source": "git",
        "url": "https://github.com/org/plugin.git",
        "branch": "main",
        "slug": "another-plugin",
        "autoActivate": false
      },
      {
        "source": "zip",
        "url": "https://example.com/premium.zip",
        "slug": "premium-plugin",
        "autoActivate": true
      },
      {
        "source": "zip",
        "url": "plugins/bundled-premium.zip",
        "slug": "bundled-premium",
        "autoActivate": true,
        "comment": "Relative path to zip file within repository"
      },
      {
        "source": "wporg",
        "slug": "wordpress-seo",
        "version": "^19.0",
        "autoActivate": true
      }
    ]
  },
  "node": {
    "autoStart": true,
    "port": 3000,
    "env": {
      "API_KEY": "${WP_API_KEY}",
      "CUSTOM_VAR": "value"
    }
  }
}
```

### Convention-Based Detection

If no `.nodeorchestrator.json` is present, the system automatically scans for plugins in conventional directories:
- `wp-plugin/`
- `wordpress-plugin/`
- `plugin/`
- `plugins/wordpress/`

Any valid WordPress plugin found in these directories will be automatically installed (but not activated by default).

---

## TypeScript Support

The API is fully typed with TypeScript. Import types as needed:

```typescript
import {
  NodeOrchestratorAPI,
  NodeApp,
  WordPressPlugin,
  PluginConfig,
  InstallProgress
} from '@local/node-orchestrator/api';
```

---

## Best Practices

1. **Always handle errors**: Wrap API calls in try-catch blocks
2. **Use progress callbacks**: Provide feedback to users during long operations
3. **Clean up on failure**: Remove partially installed resources if setup fails
4. **Validate before installing**: Check if apps/plugins already exist
5. **Use autoStart wisely**: Only auto-start apps that are meant to run with the site
6. **Document configurations**: Use `.nodeorchestrator.json` for reproducible setups

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Documentation: See README.md for general addon usage
