# Troubleshooting Guide

Common issues and solutions for the Node.js Orchestrator addon.

## App Not Starting

### Checklist

1. **Is the WordPress site running?**
   - Node.js apps require the site to be running
   - Check for "Running" status in Local

2. **Did git clone succeed?**
   - Check if the repository URL is correct
   - For private repos, ensure SSH keys are configured
   - Verify the branch name exists

3. **Did npm install succeed?**
   - Check logs for installation errors
   - Verify `package.json` exists in the repository

4. **Is the start command correct?**
   - Ensure the command matches your `package.json` scripts
   - Try running the command manually in the app directory

5. **Is the port available?**
   - Check if another process is using the allocated port
   - Ports are allocated in the 3000-3999 range

### Check the logs

App logs are stored at:
```
~/Local Sites/<site-name>/logs/node-apps/<app-id>.log
```

Open the log file to see:
- Installation output
- Build errors
- Runtime errors
- Stack traces

### Verify commands work manually

```bash
cd ~/Local\ Sites/your-site/app/node-apps/app-name
npm install   # Should complete without errors
npm start     # Should start your app
```

## Git Clone Fails

### Common causes

| Error | Solution |
|-------|----------|
| Repository not found | Verify the URL is correct |
| Permission denied | Configure SSH keys for private repos |
| Branch not found | Check the branch name exists |
| Timeout | Check network connectivity |

### Private repository access

For private repositories, use SSH URLs:
```
git@github.com:your-org/repo.git
```

Ensure your SSH key is loaded:
```bash
ssh-add -l  # Should show your key
ssh -T git@github.com  # Should authenticate
```

### HTTPS authentication

If using HTTPS URLs for private repos:
1. Use a personal access token
2. Configure git credentials on your system

## npm Install Fails

### Common causes

| Error | Solution |
|-------|----------|
| ENOENT package.json | Verify package.json exists at repo root |
| ERESOLVE | Try `npm install --legacy-peer-deps` |
| EACCES | Check directory permissions |
| Network timeout | Check proxy settings |

### Check npm availability

The addon uses system npm if available, otherwise bundled npm:

```bash
# Check if system npm works
npm --version

# Force bundled npm (for testing)
FORCE_BUNDLED_NPM=true
```

### Clear npm cache

```bash
npm cache clean --force
```

## UI Not Updating

### App status shows stale data

Try these steps in order:

1. **Navigate away and back**
   - Click on a different site
   - Click back on your site

2. **Refresh the UI**
   - Close and reopen the site details panel

3. **Restart Local**
   - Sometimes a full restart clears cache issues

### Manual status check

Open DevTools (View > Toggle Developer Tools) and run:
```javascript
// Check addon state
console.log('Checking addon...');
```

## Debug Mode

### Viewing addon logs

**Main Process Logs (Local's logs):**
- **macOS**: `~/Library/Logs/Local/local.log`
- **Windows**: `%APPDATA%\Local\logs\local.log`
- **Linux**: `~/.config/Local/logs/local.log`

Look for lines containing `[NodeOrchestrator]`:
```
[NodeOrchestrator] Adding app: my-api
[NodeOrchestrator] Git clone completed
[NodeOrchestrator] npm install started
```

**App-Specific Logs:**
```
~/Local Sites/<site>/logs/node-apps/<app-id>.log
```

**Renderer Process Logs (Browser Console):**
1. Open DevTools: **View > Toggle Developer Tools**
2. Go to **Console** tab
3. Filter by relevant messages

### Enable verbose logging

The addon logs key events automatically. To see all logs:

1. Open DevTools Console
2. Set log level to "Verbose" or "All"
3. Reproduce the issue

## Common Console Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `Adding app to site` | App creation started | Wait for completion |
| `Git clone completed` | Repository cloned | None needed |
| `npm install started` | Installing dependencies | Wait |
| `npm install completed` | Dependencies installed | None needed |
| `App started on port XXXX` | App running | Access via port |
| `App stopped` | Process terminated | Start again if needed |
| `Command validation failed` | Security check failed | Check command format |
| `Path validation failed` | Invalid path | Check app ID/paths |

## WordPress Plugin Issues

### Plugin not installing

1. **Check `.nodeorchestrator.json` syntax**
   - Validate JSON format
   - Check required fields

2. **Verify git URL or zip path**
   - For git: URL must be accessible
   - For zip: Path must be relative to app directory

3. **Check WordPress plugins directory permissions**
   ```bash
   ls -la ~/Local\ Sites/your-site/app/public/wp-content/plugins/
   ```

### Plugin not activating

1. **Check WP-CLI availability**
   - WP-CLI is bundled with Local
   - Site must be running for activation

2. **Check for plugin conflicts**
   - View WordPress admin > Plugins
   - Check for error messages

3. **Manual activation**
   - Go to WordPress admin > Plugins
   - Activate the plugin manually

## WP-CLI Errors

### Site not fully provisioned

Wait for the site to fully start. WP-CLI requires:
- MySQL/MariaDB running
- PHP running
- WordPress installed

### Database connection issues

If WP-CLI can't connect:
1. Stop the site
2. Start the site again
3. Wait for "Running" status
4. Try the operation again

### Command timeout

Some WP-CLI commands may timeout on slow systems:
1. Increase timeout in environment if possible
2. Run commands manually to test

## Port Conflicts

### Port already in use

If you see "address already in use" errors:

1. **Find process using the port**
   ```bash
   lsof -i :3000  # Replace with your port
   ```

2. **Kill the process**
   ```bash
   kill -9 <PID>
   ```

3. **Restart the app**
   - The addon will reallocate if needed

### All ports exhausted

Ports are allocated in 3000-3999 range (1000 ports). If exhausted:

1. Stop unused Node.js apps
2. Remove apps you no longer need
3. Restart Local to clear stale allocations

## Process Keeps Running After Stop

### Orphaned processes

If a Node.js process continues after stopping:

1. **Find the process**
   ```bash
   ps aux | grep node
   ```

2. **Kill it manually**
   ```bash
   kill -9 <PID>
   ```

The addon uses `tree-kill` to terminate process trees, but occasionally processes may escape.

## Addon Not Loading

### Verify installation location

The addon must be in the correct directory:
- **macOS**: `~/Library/Application Support/Local/addons/local-addon-node-orchestrator/`
- **Windows**: `%APPDATA%\Local\addons\local-addon-node-orchestrator\`
- **Linux**: `~/.config/Local/addons/local-addon-node-orchestrator/`

### Check for required files

The addon folder should contain:
```
local-addon-node-orchestrator/
├── package.json
├── lib/
│   ├── main.js
│   └── renderer.js
└── node_modules/
```

### Verify package.json

The `package.json` must have correct entries:
```json
{
  "main": "lib/main.js",
  "renderer": "lib/renderer.js"
}
```

### Check addon is enabled

1. Open Local
2. Go to Add-ons > Installed
3. Find "Node.js Orchestrator"
4. Ensure it's enabled

## Performance Issues

### Slow app startup

1. **Large node_modules**
   - First install is always slow
   - Subsequent starts should be faster

2. **Build step**
   - Build commands take time
   - Consider pre-building for production

3. **System resources**
   - Check CPU/memory usage
   - Close unnecessary applications

### High memory usage

Node.js apps consume memory. To reduce:

1. Stop unused apps
2. Remove apps you don't need
3. Check your app for memory leaks

## Reporting Issues

If you can't resolve an issue:

### Gather information

1. **Local version**: Help > About Local
2. **Operating system**: macOS/Windows/Linux and version
3. **Addon version**: Check `package.json`
4. **Error messages**: Copy from logs
5. **Steps to reproduce**: Exact actions taken

### Check existing issues

Search the repository's Issues for similar problems.

### Create a new issue

Include:
- All gathered information
- Sanitized log excerpts (remove sensitive data like paths, tokens)
- Expected vs actual behavior
- Steps to reproduce

### Security issues

For security vulnerabilities, please report privately rather than creating a public issue.
