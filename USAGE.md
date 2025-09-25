# Node.js Orchestrator - Usage Guide

## Getting Started

### Installation

1. **Download the addon**
   ```bash
   git clone https://github.com/your-org/local-addon-node-orchestrator.git
   cd local-addon-node-orchestrator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the addon**
   ```bash
   npm run build
   ```

4. **Install in Local**
   - Open Local
   - Go to Preferences → Addons
   - Click "Install from Disk"
   - Select the addon directory

## Using the Addon

### Adding Your First Node.js App

1. **Open a site in Local**
2. **Navigate to the "Node.js Apps" tab**
3. **Click "Add Node.js App"**
4. **Fill in the configuration:**
   - **App Name**: A unique identifier (e.g., `my-api`)
   - **Git URL**: Your repository URL
   - **Branch**: The branch to track (default: `main`)
   - **Install Command**: How to install deps (default: `npm install`)
   - **Start Command**: How to start the app (default: `npm start`)

### Example Configurations

#### Next.js Application
```json
{
  "name": "nextjs-frontend",
  "gitUrl": "https://github.com/vercel/next.js",
  "branch": "canary",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "startCommand": "npm run dev",
  "nodeVersion": "20.x",
  "autoStart": true
}
```

#### Express API
```json
{
  "name": "express-api",
  "gitUrl": "https://github.com/my-org/api.git",
  "branch": "main",
  "installCommand": "npm install",
  "startCommand": "node server.js",
  "nodeVersion": "20.x",
  "autoStart": true
}
```

#### Gatsby Site
```json
{
  "name": "gatsby-site",
  "gitUrl": "https://github.com/gatsbyjs/gatsby-starter-blog",
  "branch": "master",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "startCommand": "npm run develop",
  "nodeVersion": "18.x",
  "autoStart": true
}
```

## Repository Configuration

### Using .localrc.json

You can configure your Node.js app by adding a `.localrc.json` file to your repository root:

```json
{
  "installCommand": "yarn install",
  "buildCommand": "yarn build",
  "startCommand": "yarn start",
  "nodeVersion": "20.x",
  "env": {
    "API_KEY": "your-api-key",
    "DATABASE_URL": "postgresql://localhost/mydb"
  },
  "healthCheck": {
    "enabled": true,
    "endpoint": "/health",
    "interval": 30000,
    "timeout": 5000,
    "retries": 3
  }
}
```

## Environment Variables

### Default Variables

The following environment variables are automatically set:

- `PORT` - The allocated port for your app
- `NODE_ENV` - Set to `development`
- `LOCAL_SITE_ID` - The site's ID
- `LOCAL_SITE_NAME` - The site's name
- `LOCAL_SITE_DOMAIN` - The site's domain
- `LOCAL_SITE_URL` - The site's URL

### WordPress Integration

In your WordPress site, you can access Node.js app URLs:

```php
<?php
// Environment variables are available in wp-config.php
$nextjs_url = getenv('NEXTJS_FRONTEND_URL');
$api_url = getenv('EXPRESS_API_URL');

// Use in your WordPress code
define('HEADLESS_FRONTEND_URL', $nextjs_url);
define('CUSTOM_API_URL', $api_url);
```

## Managing Apps

### Starting/Stopping

- Apps with `autoStart: true` start automatically with the site
- Manual control via the UI buttons
- Apps stop automatically when the site stops

### Viewing Logs

1. Click the "Logs" button for any app
2. Logs update in real-time
3. Features:
   - Auto-scroll toggle
   - Copy all logs
   - Clear logs
   - Color-coded output

### Updating Apps

1. Stop the app
2. Click "Pull Latest" (coming soon)
3. Start the app

### Removing Apps

1. Click "Remove" button
2. Confirm the action
3. App directory and configuration are deleted

## Troubleshooting

### App Won't Start

1. **Check logs** for error messages
2. **Verify commands** work when run manually:
   ```bash
   cd ~/Local Sites/your-site/node-apps/app-name
   npm install
   npm start
   ```
3. **Check port conflicts** - ensure no other process uses the port
4. **Verify Node.js version** compatibility

### Git Clone Fails

1. **Check URL** is accessible
2. **For private repos**, ensure SSH keys are configured
3. **Check branch** exists

### Build Errors

1. **Check build command** in logs
2. **Verify dependencies** are installed
3. **Check Node.js version** requirements

### Health Check Failures

1. **Verify endpoint** returns 200 status
2. **Check timeout** isn't too short
3. **Ensure app** is fully started before health checks

## Advanced Features

### Multiple Node.js Versions

The addon detects installed Node.js versions from:
- System PATH
- NVM installations
- Local's bundled Node.js

To use a specific version:
1. Install Node.js version via NVM
2. Select in app configuration

### Custom Health Checks

Implement a health endpoint in your app:

```javascript
// Express example
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});
```

### Process Monitoring

The addon monitors:
- Process status
- CPU usage
- Memory usage
- Uptime
- Automatic restarts on crash

## Best Practices

1. **Use .localrc.json** for repository-specific configuration
2. **Implement health checks** for production-ready apps
3. **Set appropriate Node.js versions** per app
4. **Use environment variables** for configuration
5. **Monitor logs** during development
6. **Commit .localrc.json** to your repository
7. **Use build commands** for compiled apps
8. **Set autoStart** based on your workflow

## Security Considerations

1. **Private Repositories**: Use SSH keys or tokens
2. **Environment Variables**: Don't commit sensitive data
3. **Port Exposure**: Apps only bind to localhost
4. **Process Isolation**: Each app runs in its own process
5. **File System**: Apps are sandboxed to site directory

## API Reference

### IPC Channels

```typescript
// Add app
await electron.ipcRenderer.invoke('node-orchestrator:add-app', {
  siteId: 'site-123',
  app: { name, gitUrl, branch, ... }
});

// Start app
await electron.ipcRenderer.invoke('node-orchestrator:start-app', {
  siteId: 'site-123',
  appId: 'app-456'
});

// Stop app
await electron.ipcRenderer.invoke('node-orchestrator:stop-app', {
  siteId: 'site-123',
  appId: 'app-456'
});

// Get logs
await electron.ipcRenderer.invoke('node-orchestrator:get-logs', {
  siteId: 'site-123',
  appId: 'app-456',
  lines: 100
});
```

## Support

For issues and feature requests, please visit:
https://github.com/your-org/local-addon-node-orchestrator/issues
