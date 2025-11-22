# Phase 1 Manual Test Plan - WordPress Integration Features

## 🎯 Overview

This manual test plan validates all three Phase 1 distinguishing features:
1. **WordPress Environment Variables Auto-Injection**
2. **Monorepo Support with Subdirectories**
3. **WordPress Plugin Installation & Activation**

**Estimated Time**: 2-3 hours
**Prerequisites**: Local by Flywheel with at least one WordPress site

---

## 📋 Pre-Testing Setup

### 1. Build the Addon

```bash
cd /Users/jeremy.pollock/development/wpengine/local/addons/local-addon-node-orchestrator
npm install
npm run build
```

**Expected**: TypeScript compiles successfully, `lib/` directory created

### 2. Link Addon to Local (if not already)

```bash
# Backup existing if present
mv ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator.backup

# Create symlink
ln -sf $(pwd) ~/Library/Application\ Support/Local/addons/local-addon-node-orchestrator
```

### 3. Restart Local

- Quit Local completely
- Start Local
- Open any WordPress site
- Verify "Node.js Apps" or "Node Orchestrator" tab appears in site overview

### 4. Check Logs

Open Local's main log file to monitor for errors:
```bash
tail -f ~/Library/Logs/local-by-flywheel/main.log
```

**Look for**:
- ✅ `[Node Orchestrator] Addon loaded`
- ❌ Any error messages about missing files or imports

---

## 🧪 Test Suite 1: WordPress Environment Variables Auto-Injection

### Test 1.1: Basic WordPress Environment Injection

**Objective**: Verify WordPress environment variables are automatically injected into Node.js apps

**Setup**:
1. Create a test Node.js app repository with this code:

```javascript
// index.js
console.log('=== WordPress Environment Variables ===');
console.log('WP_DB_HOST:', process.env.WP_DB_HOST);
console.log('WP_DB_NAME:', process.env.WP_DB_NAME);
console.log('WP_DB_USER:', process.env.WP_DB_USER);
console.log('WP_DB_PASSWORD:', process.env.WP_DB_PASSWORD ? '***SET***' : 'NOT SET');
console.log('WP_SITE_URL:', process.env.WP_SITE_URL);
console.log('WP_HOME_URL:', process.env.WP_HOME_URL);
console.log('WP_ADMIN_URL:', process.env.WP_ADMIN_URL);
console.log('WP_CONTENT_DIR:', process.env.WP_CONTENT_DIR);
console.log('WP_UPLOADS_DIR:', process.env.WP_UPLOADS_DIR);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***SET***' : 'NOT SET');
console.log('=====================================');

setTimeout(() => {
  console.log('App running...');
}, 1000000);
```

```json
// package.json
{
  "name": "wp-env-test",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
```

2. Push to a Git repository (GitHub, GitLab, etc.)

**Test Steps**:
1. Open a WordPress site in Local
2. Go to Node.js Apps tab
3. Click "Add App"
4. Fill in:
   - **Name**: `wp-env-test`
   - **Git URL**: `<your-test-repo-url>`
   - **Branch**: `main` or `master`
   - **Install Command**: `npm install`
   - **Build Command**: (leave empty)
   - **Start Command**: `npm start`
   - **Node Version**: `20.x`
   - **Auto Start**: Checked
   - **Inject WordPress Environment**: Checked (should be default)
5. Click "Add" or "Install"
6. Wait for installation to complete
7. Click "Start" (if not auto-started)
8. View logs

**Expected Results**:
- ✅ All WP_* environment variables are present and have values
- ✅ `WP_DB_PASSWORD` shows `***SET***` (not the actual password)
- ✅ `DATABASE_URL` shows `***SET***`
- ✅ `WP_SITE_URL` matches your Local site URL (e.g., `http://mysite.local`)
- ✅ `WP_DB_HOST` is `localhost` or similar
- ✅ `WP_DB_NAME` matches your site's database name
- ✅ No actual passwords visible in logs

**Pass Criteria**: All 9 environment variables present with correct values

---

### Test 1.2: Database Connection Test

**Objective**: Verify Node.js app can actually connect to WordPress database

**Setup**: Create a test app with database connection:

```javascript
// db-test.js
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing WordPress database connection...');

  try {
    const connection = await mysql.createConnection({
      host: process.env.WP_DB_HOST,
      user: process.env.WP_DB_USER,
      password: process.env.WP_DB_PASSWORD,
      database: process.env.WP_DB_NAME
    });

    console.log('✅ Connected to WordPress database!');

    // Test query
    const [rows] = await connection.execute(
      'SELECT option_name, option_value FROM wp_options WHERE option_name = ?',
      ['siteurl']
    );

    console.log('Site URL from database:', rows[0]?.option_value);

    await connection.end();
    console.log('✅ Database test passed!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }

  setTimeout(() => {}, 100000);
}

testConnection();
```

```json
// package.json
{
  "name": "wp-db-test",
  "version": "1.0.0",
  "dependencies": {
    "mysql2": "^3.0.0"
  },
  "scripts": {
    "start": "node db-test.js"
  }
}
```

**Test Steps**:
1. Add this app via Node.js Apps tab
2. Start the app
3. Check logs

**Expected Results**:
- ✅ `Connected to WordPress database!`
- ✅ Site URL matches your WordPress site
- ✅ `Database test passed!`
- ❌ No connection errors

**Pass Criteria**: App successfully connects to WordPress database using injected credentials

---

### Test 1.3: Toggle WordPress Environment Injection

**Objective**: Verify `injectWpEnv: false` disables environment injection

**Test Steps**:
1. Edit the `wp-env-test` app (if edit functionality exists in UI)
2. OR add a new app with same config but:
   - **Inject WordPress Environment**: Unchecked
3. Start the app
4. Check logs

**Expected Results**:
- ✅ All WP_* variables show `undefined` or `NOT SET`
- ✅ App runs without environment variables

**Pass Criteria**: WordPress env vars not injected when toggle is off

---

### Test 1.4: Credential Sanitization in Logs

**Objective**: Verify credentials are never exposed in logs

**Test Steps**:
1. Check Local's main log file: `~/Library/Logs/local-by-flywheel/main.log`
2. Search for database password
3. Search for "WP_DB_PASSWORD"

**Expected Results**:
- ❌ Actual database password NEVER appears in plain text
- ✅ Only `***REDACTED***` or similar appears
- ✅ DATABASE_URL (if logged) has password masked

**Pass Criteria**: Zero instances of plain-text passwords in logs

---

## 🧪 Test Suite 2: Monorepo Support with Subdirectories

### Test 2.1: Simple Subdirectory App

**Objective**: Clone a monorepo and run an app from a subdirectory

**Setup**: Create a monorepo structure:

```
my-monorepo/
├── packages/
│   ├── api/
│   │   ├── package.json
│   │   └── index.js
│   └── frontend/
│       ├── package.json
│       └── index.js
└── package.json (root)
```

**packages/api/package.json**:
```json
{
  "name": "api",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  }
}
```

**packages/api/index.js**:
```javascript
console.log('API running from subdirectory!');
console.log('Current directory:', __dirname);
setTimeout(() => {}, 100000);
```

**Test Steps**:
1. Push monorepo to Git
2. Add app in Local:
   - **Name**: `monorepo-api`
   - **Git URL**: `<monorepo-url>`
   - **Branch**: `main`
   - **Subdirectory**: `packages/api`
   - **Start Command**: `npm start`
3. Start the app
4. Check logs

**Expected Results**:
- ✅ Git clone succeeds
- ✅ `npm install` runs in `packages/api` directory
- ✅ App starts from subdirectory
- ✅ Log shows "API running from subdirectory!"
- ✅ Current directory is `/path/to/site/node-apps/<app-id>/packages/api`

**Pass Criteria**: App runs successfully from subdirectory

---

### Test 2.2: Nested Subdirectory

**Objective**: Test deeply nested subdirectories

**Setup**: Monorepo with nested path like `apps/backend/api/src`

**Test Steps**:
1. Create app with subdirectory: `apps/backend/api`
2. Verify it works

**Expected Results**:
- ✅ Nested path accepted
- ✅ App installs and runs correctly

**Pass Criteria**: Nested subdirectories work

---

### Test 2.3: Security - Path Traversal Attempt

**Objective**: Verify path traversal attacks are blocked

**Test Steps**:
1. Try to add app with subdirectory: `../../etc`
2. Try: `../../../etc/passwd`
3. Try: `/etc/passwd` (absolute path)
4. Try: `packages/../../../etc`

**Expected Results**:
- ❌ All attempts REJECTED with validation error
- ❌ Error message: "Path traversal detected" or similar
- ✅ No app created
- ✅ No files accessed outside repository

**Pass Criteria**: All path traversal attempts blocked at validation

---

### Test 2.4: Non-existent Subdirectory

**Objective**: Graceful error when subdirectory doesn't exist

**Test Steps**:
1. Add app with subdirectory: `packages/does-not-exist`
2. Attempt to install

**Expected Results**:
- ❌ Installation fails with clear error
- ✅ Error message: "Subdirectory not found: packages/does-not-exist"
- ✅ No app created
- ✅ Repository cleaned up

**Pass Criteria**: Clear error message, graceful failure

---

### Test 2.5: Subdirectory Without package.json

**Objective**: Validate subdirectory contains valid Node.js project

**Test Steps**:
1. Create subdirectory without package.json
2. Try to add app pointing to it

**Expected Results**:
- ❌ Installation fails
- ✅ Error: "No package.json found in subdirectory"

**Pass Criteria**: Validation ensures package.json exists

---

## 🧪 Test Suite 3: WordPress Plugin Installation & Activation

### Test 3.1: Install Simple WordPress Plugin from Git

**Objective**: Install a WordPress plugin from a Git repository

**Setup**: Use a simple test plugin or create one:

```php
<?php
/**
 * Plugin Name: Test Plugin
 * Plugin URI: https://example.com
 * Description: A test plugin for Node Orchestrator
 * Version: 1.0.0
 * Author: Test Author
 */

add_action('admin_notices', function() {
    echo '<div class="notice notice-success"><p>Test Plugin is active!</p></div>';
});
```

Save as `test-plugin/test-plugin.php` and push to Git.

**Test Steps**:
1. Open Local site
2. Use IPC handler (via code or future UI) to install plugin:
   ```javascript
   // In browser console or via IPC
   ipcRenderer.invoke('node-orchestrator:install-plugin', {
     siteId: '<your-site-id>',
     plugin: {
       name: 'Test Plugin',
       gitUrl: '<plugin-repo-url>',
       branch: 'main',
       slug: 'test-plugin',
       autoActivate: false
     }
   });
   ```
3. Check WordPress admin → Plugins

**Expected Results**:
- ✅ Plugin files copied to `wp-content/plugins/test-plugin/`
- ✅ Plugin appears in WordPress Plugins list
- ✅ Status: "Installed" (not activated)

**Pass Criteria**: Plugin installed successfully

---

### Test 3.2: Activate WordPress Plugin

**Objective**: Activate plugin via WP-CLI

**Test Steps**:
1. After Test 3.1, activate the plugin:
   ```javascript
   ipcRenderer.invoke('node-orchestrator:activate-plugin', {
     siteId: '<your-site-id>',
     pluginId: '<plugin-id-from-install>'
   });
   ```
2. Refresh WordPress admin → Plugins page
3. Check for admin notice

**Expected Results**:
- ✅ Plugin shows as "Active" in WordPress
- ✅ Admin notice appears: "Test Plugin is active!"
- ✅ Plugin config updated to `status: 'active'`

**Pass Criteria**: Plugin activates successfully

---

### Test 3.3: Deactivate WordPress Plugin

**Objective**: Deactivate plugin via WP-CLI

**Test Steps**:
1. Deactivate the plugin:
   ```javascript
   ipcRenderer.invoke('node-orchestrator:deactivate-plugin', {
     siteId: '<your-site-id>',
     pluginId: '<plugin-id>'
   });
   ```
2. Refresh WordPress admin

**Expected Results**:
- ✅ Plugin shows as "Inactive" in WordPress
- ✅ Admin notice no longer appears
- ✅ Plugin config updated to `status: 'inactive'`

**Pass Criteria**: Plugin deactivates successfully

---

### Test 3.4: Remove WordPress Plugin

**Objective**: Remove plugin completely

**Test Steps**:
1. Remove the plugin:
   ```javascript
   ipcRenderer.invoke('node-orchestrator:remove-plugin', {
     siteId: '<your-site-id>',
     pluginId: '<plugin-id>'
   });
   ```
2. Check WordPress admin
3. Check filesystem: `wp-content/plugins/test-plugin/`

**Expected Results**:
- ✅ Plugin no longer in WordPress Plugins list
- ✅ Plugin directory deleted from filesystem
- ✅ Plugin config removed from JSON

**Pass Criteria**: Plugin fully removed

---

### Test 3.5: Install Monorepo Plugin

**Objective**: Install plugin from monorepo subdirectory

**Setup**: Create monorepo with plugin in subdirectory:

```
monorepo/
├── packages/
│   ├── wp-plugin/
│   │   └── my-plugin.php
│   └── other-stuff/
└── package.json
```

**Test Steps**:
1. Install plugin with subdirectory:
   ```javascript
   ipcRenderer.invoke('node-orchestrator:install-plugin', {
     siteId: '<site-id>',
     plugin: {
       name: 'Monorepo Plugin',
       gitUrl: '<monorepo-url>',
       branch: 'main',
       subdirectory: 'packages/wp-plugin',
       slug: 'monorepo-plugin',
       autoActivate: true
     }
   });
   ```
2. Check WordPress

**Expected Results**:
- ✅ Only `packages/wp-plugin` contents copied to wp-content/plugins
- ✅ Plugin detected and activated
- ✅ Works correctly

**Pass Criteria**: Monorepo plugin installs from subdirectory

---

### Test 3.6: Auto-Activate Plugin on Install

**Objective**: Verify `autoActivate: true` works

**Test Steps**:
1. Install plugin with `autoActivate: true`
2. Check WordPress immediately (without separate activate call)

**Expected Results**:
- ✅ Plugin installed AND activated in one step
- ✅ Status shows "Active" immediately

**Pass Criteria**: Auto-activation works

---

### Test 3.7: Plugin Persistence Across Restart

**Objective**: Verify plugin config persists

**Test Steps**:
1. Install and activate a plugin
2. Restart Local site
3. Check plugin list:
   ```javascript
   ipcRenderer.invoke('node-orchestrator:get-plugins', {
     siteId: '<site-id>'
   });
   ```
4. Check WordPress admin

**Expected Results**:
- ✅ Plugin still in config after restart
- ✅ Plugin still active in WordPress
- ✅ All plugin metadata preserved

**Pass Criteria**: Plugin configuration survives restart

---

### Test 3.8: WP-CLI Path Detection

**Objective**: Verify WP-CLI is found correctly

**Test Steps**:
1. Check Local logs for WP-CLI path detection
2. Look for: `[WpCliManager] Using WP-CLI at: /path/to/wp`

**Expected Results**:
- ✅ WP-CLI path detected automatically
- ✅ Path is valid and executable
- ✅ Most likely: `/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp`

**Pass Criteria**: WP-CLI detected and usable

---

### Test 3.9: Security - Plugin Slug Validation

**Objective**: Verify malicious plugin slugs are rejected

**Test Steps**:
1. Try to install plugin with slug: `../../evil-plugin`
2. Try: `/etc/passwd`
3. Try: `my-plugin; rm -rf /`
4. Try: `my-plugin$(whoami)`

**Expected Results**:
- ❌ All attempts REJECTED at validation
- ✅ Error: "Invalid or dangerous characters"
- ✅ No filesystem operations performed

**Pass Criteria**: All malicious slugs blocked

---

## 🧪 Test Suite 4: Integration Tests

### Test 4.1: All Three Features Together

**Objective**: Use all features in combination

**Test Steps**:
1. Install a Node.js API from monorepo subdirectory
2. Verify WordPress env vars injected
3. Have API connect to WordPress database
4. Install a WordPress plugin from Git
5. Activate the plugin
6. Have Node.js API query WordPress to check plugin is active

**Expected Results**:
- ✅ All features work together seamlessly
- ✅ No conflicts or errors
- ✅ Node.js app can verify plugin activation via database query

**Pass Criteria**: Complete workflow works end-to-end

---

### Test 4.2: Multiple Apps + Multiple Plugins

**Objective**: Test with multiple items

**Test Steps**:
1. Add 3 Node.js apps (1 regular, 2 from monorepo subdirectories)
2. Install 2 WordPress plugins
3. Start all apps
4. Activate all plugins
5. Verify everything works

**Expected Results**:
- ✅ All apps run simultaneously
- ✅ All apps get WordPress env vars
- ✅ All plugins installed and active
- ✅ No port conflicts
- ✅ Configs stored correctly

**Pass Criteria**: Multiple items managed successfully

---

## 📊 Test Results Tracking

### Test Summary Sheet

| Test ID | Feature | Test Name | Status | Notes |
|---------|---------|-----------|--------|-------|
| 1.1 | WP Env | Basic Injection | ⏳ | |
| 1.2 | WP Env | DB Connection | ⏳ | |
| 1.3 | WP Env | Toggle Off | ⏳ | |
| 1.4 | WP Env | Credential Sanitization | ⏳ | |
| 2.1 | Monorepo | Simple Subdirectory | ⏳ | |
| 2.2 | Monorepo | Nested Path | ⏳ | |
| 2.3 | Monorepo | Path Traversal Block | ⏳ | |
| 2.4 | Monorepo | Non-existent Subdir | ⏳ | |
| 2.5 | Monorepo | No package.json | ⏳ | |
| 3.1 | WP Plugin | Install from Git | ⏳ | |
| 3.2 | WP Plugin | Activate | ⏳ | |
| 3.3 | WP Plugin | Deactivate | ⏳ | |
| 3.4 | WP Plugin | Remove | ⏳ | |
| 3.5 | WP Plugin | Monorepo Plugin | ⏳ | |
| 3.6 | WP Plugin | Auto-Activate | ⏳ | |
| 3.7 | WP Plugin | Persistence | ⏳ | |
| 3.8 | WP Plugin | WP-CLI Detection | ⏳ | |
| 3.9 | WP Plugin | Slug Validation | ⏳ | |
| 4.1 | Integration | All Features | ⏳ | |
| 4.2 | Integration | Multiple Items | ⏳ | |

**Legend**: ⏳ Not Started | 🔄 In Progress | ✅ Passed | ❌ Failed

---

## 🐛 Issue Tracking

### Found Issues Template

For each issue found:

```markdown
**Issue ID**: #001
**Test**: 1.2 (DB Connection Test)
**Severity**: High / Medium / Low
**Description**: Database connection fails with error "ECONNREFUSED"
**Expected**: App connects to WordPress database
**Actual**: Connection refused error
**Steps to Reproduce**:
1. Add wp-db-test app
2. Start app
3. Check logs

**Logs**:
```
[Error snippet from logs]
```

**Possible Cause**: Database credentials not extracted correctly from Local site object
**Suggested Fix**: Check WordPressEnvManager.extractWordPressEnv() implementation
```

---

## ✅ Definition of Done - Phase 1

Phase 1 is considered **READY FOR v2.1.0-beta.1** when:

- [ ] All Test Suite 1 tests pass (WordPress Env Vars)
- [ ] All Test Suite 2 tests pass (Monorepo Support)
- [ ] All Test Suite 3 tests pass (WordPress Plugins)
- [ ] Integration tests (Suite 4) pass
- [ ] Zero high-severity bugs
- [ ] All security tests pass (path traversal, slug validation, credential sanitization)
- [ ] TypeScript compiles without errors
- [ ] No console errors in Local

---

## 📞 Testing Support

### Debugging Tips

**If app won't start**:
1. Check logs: `~/Library/Logs/local-by-flywheel/main.log`
2. Check app logs: `~/Local Sites/<site>/logs/node-apps/<app-id>.log`
3. Verify Node.js version compatibility
4. Check for port conflicts

**If WP env vars not injected**:
1. Verify `injectWpEnv` is `true` in app config
2. Check Local site object structure (may vary by Local version)
3. Check logs for extraction errors
4. Manually inspect site config in Local

**If WP-CLI not found**:
1. Check Local installation path
2. Verify WP-CLI binary exists
3. Check file permissions
4. Try system `wp` command as fallback

**If plugin install fails**:
1. Check Git URL is accessible
2. Verify plugin has WordPress headers
3. Check wp-content/plugins directory permissions
4. Review WP-CLI output in logs

---

## 📝 Test Report Template

After completing all tests, create a summary:

```markdown
# Phase 1 Manual Test Report

**Date**: [Date]
**Tester**: [Your Name]
**Local Version**: [e.g., 6.7.0]
**OS**: [macOS, Windows, Linux]
**Addon Version**: sculptor/add-wp-env-auto-injection branch

## Summary
- **Total Tests**: 20
- **Passed**: X
- **Failed**: Y
- **Not Tested**: Z

## Test Results
[Copy table from Test Summary Sheet]

## Issues Found
[List all issues with details]

## Recommendations
[Suggestions for fixes or improvements]

## Sign-Off
- [ ] Phase 1 ready for v2.1.0-beta.1 release
- [ ] Phase 1 needs fixes before release

**Notes**: [Any additional observations]
```

---

**Good luck with testing!** 🚀

If you find issues, check the implementation files and tests for hints on expected behavior. The agents wrote comprehensive tests that can serve as additional documentation.
