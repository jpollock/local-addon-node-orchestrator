---
layout: default
title: Home
---

# Node.js Orchestrator for Local

![Beta](https://img.shields.io/badge/status-beta-orange) ![License](https://img.shields.io/badge/license-MIT-blue) ![Local](https://img.shields.io/badge/Local-v6.0%2B-green)

Run Node.js applications alongside your WordPress sites in Local. Clone apps from git repositories, manage their lifecycle, and seamlessly integrate with WordPress.

![Demo of Node.js Orchestrator](docs/assets/demo.gif)

## Features

- **Git Integration** - Clone and manage Node.js apps from any git repository
- **Lifecycle Management** - Apps start/stop automatically with your WordPress site
- **WordPress Integration** - Auto-inject WordPress database credentials and URLs
- **Port Management** - Automatic port allocation and conflict resolution
- **Multiple Apps** - Run multiple Node.js services per WordPress site
- **Plugin Support** - Bundle WordPress plugins with your Node.js app

## Use Cases

- **Headless WordPress** - Run Next.js/Gatsby frontends alongside WordPress
- **API Services** - Custom Node.js APIs with WordPress database access
- **Build Tools** - Webpack dev servers, asset compilation
- **Background Workers** - Queue workers, job processing

## Quick Start

### Installation

\`\`\`bash
# Clone and build
git clone https://github.com/your-org/local-addon-node-orchestrator.git
cd local-addon-node-orchestrator
npm install
npm run build

# Symlink to Local (macOS)
ln -sf "$(pwd)" ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator

# Restart Local, then enable the addon:
# Local > Add-ons > Installed > Node.js Orchestrator > Enable
\`\`\`

### Add Your First App

1. Start a WordPress site in Local
2. Go to the **Node.js Apps** tab
3. Click **Add App**
4. Enter your git repository URL
5. Configure start command
6. Click **Create**

Your Node.js app will clone, install dependencies, and start automatically.

## Documentation

- [User Guide](docs/USER_GUIDE.md) - Complete guide for end users
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Technical documentation for contributors
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## WordPress Integration

Node.js apps automatically receive WordPress environment variables:

\`\`\`javascript
process.env.WP_DB_HOST       // localhost:10006
process.env.WP_DB_NAME       // local
process.env.WP_DB_USER       // root
process.env.WP_DB_PASSWORD   // root
process.env.WP_SITE_URL      // http://mysite.local
process.env.DATABASE_URL     // mysql://root:root@localhost:10006/local
\`\`\`

## Security

The addon implements a 4-layer security architecture:
1. **Input Validation** - Zod schemas validate all IPC requests
2. **Command Validation** - Whitelist of allowed commands
3. **Path Validation** - Prevents directory traversal attacks
4. **Error Sanitization** - Removes sensitive data from errors

## Requirements

- Local v6.0.0 or higher
- Git installed on your system
- Node.js not required (uses Local's bundled Node.js)

## Feedback & Issues

This addon is currently in **beta**. We welcome your feedback!

- **Report bugs or request features**: [GitHub Issues](https://github.com/your-org/local-addon-node-orchestrator/issues)
- **View source code**: [GitHub Repository](https://github.com/your-org/local-addon-node-orchestrator)

## License

MIT License - see the repository for full license text.
