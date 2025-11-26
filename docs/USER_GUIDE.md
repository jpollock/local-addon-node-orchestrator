# User Guide

## Overview

Node.js Orchestrator lets you run Node.js applications alongside your WordPress sites in Local. Clone apps from git repositories, manage their lifecycle, and integrate them with WordPress - all from Local's interface.

![Demo of Node.js Orchestrator](assets/demo.gif)

## Installation

### For Development (with symlink)

If you're developing or testing the addon:

```bash
# Clone the repository
git clone https://github.com/your-org/local-addon-node-orchestrator.git
cd local-addon-node-orchestrator

# Install dependencies and build
npm install
npm run build

# Symlink to Local's addons directory
# macOS:
ln -sf "$(pwd)" ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator

# Windows (PowerShell as admin):
New-Item -ItemType Junction -Path "$env:APPDATA\Local\addons\local-addon-node-orchestrator" -Target (Get-Location)

# Linux:
ln -sf "$(pwd)" ~/.config/Local/addons/local-addon-node-orchestrator

# Restart Local, then enable the addon:
# Local > Add-ons > Installed > Node.js Orchestrator > Enable
```

### For Production (manual copy)

1. Download the latest release from GitHub
2. Copy the `local-addon-node-orchestrator` folder to your Local addons directory:
   - **macOS**: `~/Library/Application Support/Local/addons/`
   - **Windows**: `%APPDATA%\Local\addons\`
   - **Linux**: `~/.config/Local/addons/`
3. Restart Local
4. Enable the addon: **Local > Add-ons > Installed > Node.js Orchestrator > Enable**

## Uninstallation

### If installed via symlink

```bash
# macOS/Linux
rm ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator  # macOS
rm ~/.config/Local/addons/local-addon-node-orchestrator  # Linux

# Windows (PowerShell as admin)
Remove-Item "$env:APPDATA\Local\addons\local-addon-node-orchestrator"
```

Then restart Local.

### If installed manually

1. Navigate to your Local addons directory (see paths above)
2. Delete the `local-addon-node-orchestrator` folder
3. Restart Local

## How It Works

When you add a Node.js app to a WordPress site:

1. **Git Clone**: The addon clones your repository to the site's `node-apps` directory
2. **Dependency Installation**: Runs your install command (`npm install` by default)
3. **Build** (optional): Runs your build command if configured
4. **Port Allocation**: Automatically assigns an available port (3000-3999)
5. **Process Start**: Spawns your Node.js app with the configured start command
6. **WordPress Integration**: Injects WordPress database credentials as environment variables

## Adding Your First Node.js App

1. **Start a site** in Local (the site must be running)
2. **Navigate** to the "Node.js Apps" tab in the site view
3. **Click "Add Node.js App"**
4. **Fill in the configuration:**
   - **App Name**: A unique identifier (e.g., `my-api`)
   - **Git URL**: Your repository URL (HTTPS or SSH)
   - **Branch**: The branch to clone (default: `main`)
   - **Install Command**: How to install dependencies (default: `npm install`)
   - **Build Command**: Optional build step (e.g., `npm run build`)
   - **Start Command**: How to start the app (default: `npm start`)
   - **Auto Start**: Whether to start automatically with the site

## Configuration Options

### Example Configurations

#### Next.js Application

```json
{
  "name": "nextjs-frontend",
  "gitUrl": "https://github.com/your-org/nextjs-app.git",
  "branch": "main",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "startCommand": "npm run dev",
  "autoStart": true
}
```

#### Express API

```json
{
  "name": "express-api",
  "gitUrl": "https://github.com/your-org/api.git",
  "branch": "main",
  "installCommand": "npm install",
  "startCommand": "node server.js",
  "autoStart": true
}
```

#### Gatsby Site

```json
{
  "name": "gatsby-site",
  "gitUrl": "https://github.com/your-org/gatsby-site.git",
  "branch": "master",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "startCommand": "npm run develop",
  "autoStart": false
}
```

### Using .localrc.json

Configure your Node.js app by adding a `.localrc.json` file to your repository root:

```json
{
  "installCommand": "yarn install",
  "buildCommand": "yarn build",
  "startCommand": "yarn start",
  "env": {
    "API_KEY": "your-api-key",
    "DEBUG": "app:*"
  }
}
```

## WordPress Integration

### Automatic Environment Variables

When WordPress integration is enabled (default), your Node.js app automatically receives these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `WP_DB_HOST` | Database host and port | `localhost:10006` |
| `WP_DB_NAME` | Database name | `local` |
| `WP_DB_USER` | Database user | `root` |
| `WP_DB_PASSWORD` | Database password | `root` |
| `WP_SITE_URL` | WordPress site URL | `http://mysite.local` |
| `WP_HOME_URL` | WordPress home URL | `http://mysite.local` |
| `WP_ADMIN_URL` | WordPress admin URL | `http://mysite.local/wp-admin` |
| `WP_CONTENT_DIR` | Path to wp-content | `/path/to/wp-content` |
| `DATABASE_URL` | Connection string | `mysql://root:root@localhost:10006/local` |
| `PORT` | Allocated port for your app | `3000` |

### Example: Connect to WordPress Database

```javascript
// Express.js API querying WordPress
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.WP_DB_HOST.split(':')[0],
  port: process.env.WP_DB_HOST.split(':')[1] || 3306,
  user: process.env.WP_DB_USER,
  password: process.env.WP_DB_PASSWORD,
  database: process.env.WP_DB_NAME
});

app.get('/api/posts', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM wp_posts WHERE post_status = ? LIMIT 10',
    ['publish']
  );
  res.json(rows);
});
```

### Bundled WordPress Plugins

Configure plugins to install with your Node.js app using `.nodeorchestrator.json`:

```json
{
  "wpPlugins": [
    {
      "name": "My Custom Plugin",
      "source": "git",
      "gitUrl": "https://github.com/your-org/wp-plugin.git",
      "branch": "main",
      "slug": "my-custom-plugin",
      "activate": true
    },
    {
      "name": "Local Plugin",
      "source": "zip",
      "zipPath": "plugins/my-plugin.zip",
      "slug": "my-plugin",
      "activate": true
    }
  ]
}
```

## Managing Apps

### Starting and Stopping

- Apps with **Auto Start** enabled start automatically with the WordPress site
- Use the **Start/Stop** buttons in the UI for manual control
- Apps stop automatically when the WordPress site stops

### Viewing Logs

1. Click the **Logs** button for any app
2. Logs update in real-time
3. Features:
   - Auto-scroll toggle
   - Copy all logs
   - Clear logs
   - Color-coded output (stdout/stderr)

### Updating Apps

1. Stop the app
2. Click **Pull Latest** to fetch new commits
3. Re-run install/build if dependencies changed
4. Start the app

### Removing Apps

1. Stop the app first
2. Click **Remove**
3. Confirm deletion
4. App directory and configuration are deleted

## Environment Variables

### Custom Environment Variables

Add custom environment variables through the UI:

1. Click the **Environment** button for an app
2. Add key-value pairs
3. Click **Save**
4. Restart the app for changes to take effect

### Default Variables

These are always available:

| Variable | Description |
|----------|-------------|
| `PORT` | Allocated port for your app |
| `NODE_ENV` | Set to `development` |
| `LOCAL_SITE_ID` | The Local site's ID |
| `LOCAL_SITE_NAME` | The site's name |
| `LOCAL_SITE_DOMAIN` | The site's domain |

## Supported Scenarios

### Headless WordPress

Run a Next.js or Gatsby frontend alongside WordPress:
- Node.js app fetches content via WordPress REST API
- WordPress provides content management
- Node.js serves the frontend

### Custom API Services

Add Express, Fastify, or other Node.js APIs:
- Direct database access via auto-injected credentials
- Run alongside WordPress for extended functionality

### Build Tools

Run development servers and build tools:
- Webpack dev server
- Vite
- Asset compilation

### Background Workers

Run queue workers or background jobs:
- Process webhook events
- Handle file processing
- Run scheduled tasks

## What This Addon Does NOT Do

- **Replace Node.js installation**: Uses Local's bundled Node.js or system Node.js
- **Manage production deployments**: This is for local development only
- **Handle Docker containers**: Apps run as native Node.js processes
- **Support all npm scripts**: Only whitelisted commands for security

## Allowed Commands

For security, only these commands are permitted:

| Executable | Allowed Subcommands |
|------------|---------------------|
| `npm` | `start`, `run`, `install`, `build`, `test`, `dev`, `ci` |
| `yarn` | `start`, `run`, `install`, `build`, `test`, `dev` |
| `pnpm` | `start`, `run`, `install`, `build`, `test`, `dev` |
| `bun` | `start`, `run`, `install`, `build`, `test`, `dev` |
| `node` | Any relative script path |

## FAQ

### Why doesn't my app start?

Possible reasons:
- The WordPress site isn't running (start it first)
- The git clone failed (check the Git URL and branch)
- Dependencies failed to install (check logs)
- The start command has an error (check logs)

### Can I use private git repositories?

Yes, if you have SSH keys configured:
- Use SSH URLs: `git@github.com:org/repo.git`
- Ensure your SSH agent has your keys loaded

### Does this work with Docker-based sites?

Currently, the addon works best with Local's native environment. Docker support may vary.

### What Node.js version is used?

The addon uses Local's bundled Node.js or falls back to your system Node.js if available. You don't need Node.js installed on your system.

### How do I change the port?

Ports are automatically allocated in the 3000-3999 range. The allocated port is passed via the `PORT` environment variable.

### Can I run multiple apps per site?

Yes! Each site can have multiple Node.js apps, each with its own port and configuration.

### Is this addon safe?

Yes. The addon:
- Validates all commands against a whitelist
- Prevents command injection attacks
- Sanitizes paths to prevent traversal
- Only runs in Local's controlled environment
- Never transmits data externally
