# Monorepo Support Fix - Complete

## Problem

You were getting this error when trying to add your Node.js app from the monorepo:

```
Failed to add Node.js app -- {"error":{"message":"No package.json found in repository root"}}
```

## Root Cause

The WordPress Plugin form had a **Subdirectory** field for monorepo support, but the **Node.js App form was missing it**!

When you tried to add `https://github.com/jpollock/node-wp-app-for-local-addon.git`, the addon was looking for `package.json` in the repository root, but it's actually in the `node-app/` subdirectory.

The backend code (GitManager.ts) already supported subdirectories - it was just the UI form that was missing the field.

## What Was Fixed

### 1. Added `subdirectory` to Node.js App Form State

Updated all places where `formData` is initialized to include the `subdirectory` field:
- Initial state (src/renderer.tsx:28)
- After successful add (line 128)
- In handleEditApp (line 216)
- After successful update (line 247)
- In handleCancelEdit (line 274)

### 2. Added Subdirectory Input Field to Form

Added the subdirectory input field to the Node.js app form (src/renderer.tsx:528):
```typescript
this.renderInput('Subdirectory', 'subdirectory', formData.subdirectory, 'node-app', false,
  'For monorepos: path to app folder (e.g., node-app or packages/my-app)')
```

The field appears after "Branch" and before the Node.js version info box.

### 3. Added Subdirectory Display to App List

Updated the app list to show the subdirectory when present (src/renderer.tsx:619):
```typescript
app.subdirectory && React.createElement('div', null, `Subdirectory: ${app.subdirectory}`)
```

## How to Test

### Step 1: Rebuild

The addon needs to be rebuilt to compile the TypeScript changes:

```bash
cd ~/development/wpengine/local/addons/local-addon-node-orchestrator
npm run build
```

### Step 2: Restart Local

Restart Local by Flywheel to load the new UI.

### Step 3: Add Your Node.js App

1. Go to your site in Local
2. Scroll to "🚀 Node.js Orchestrator" section
3. Click "Add Node.js App"
4. Fill in the form:
   - **App Name**: `node-wp-app`
   - **Git Repository URL**: `https://github.com/jpollock/node-wp-app-for-local-addon.git`
   - **Branch**: `main`
   - **Subdirectory**: `node-app` ← **This is the key field!**
   - **Install Command**: (leave empty for auto-detect)
   - **Start Command**: `npm start`
   - **Auto-start**: ✓ (checked)
5. Click "Add App"

The addon will now:
1. Clone the repository
2. Look for `package.json` in `node-app/` subdirectory
3. Install dependencies with npm
4. Start the app automatically

### Step 4: Add Your WordPress Plugin

1. Scroll down to "🔌 WordPress Plugins" section
2. Click "Add WordPress Plugin"
3. Fill in the form:
   - **Plugin Name**: `Node WP App Plugin`
   - **Git Repository URL**: `https://github.com/jpollock/node-wp-app-for-local-addon.git`
   - **Branch**: `main`
   - **Subdirectory**: `wp-plugin`
   - **Plugin Slug**: `node-wp-app-plugin` (or whatever your plugin folder is named)
   - **Auto-activate**: ✓ (checked)
4. Click "Install Plugin"

## Files Modified

1. **src/renderer.tsx**
   - Added `subdirectory: ''` to formData in state (line 28)
   - Added `subdirectory: ''` to all formData resets (lines 128, 247, 274)
   - Added `subdirectory: app.subdirectory || ''` to handleEditApp (line 216)
   - Added subdirectory input field to renderForm() (line 528)
   - Added subdirectory display to renderAppsList() (line 619)

## Backend Support (Already Implemented)

The backend already had full monorepo support:

1. **GitManager.ts** (lines 121-159):
   - Detects subdirectory in clone options
   - Looks for `package.json` in subdirectory
   - Returns clear error if package.json not found

2. **schemas.ts**:
   - Validates subdirectory paths
   - Prevents path traversal attacks
   - 4-layer security validation

3. **NodeAppManager.ts**:
   - Uses subdirectory when cloning
   - Installs dependencies in correct location
   - Runs commands in subdirectory working path

## What This Enables

✅ **Monorepo Support**: Both Node.js apps and WordPress plugins can be in the same Git repository
✅ **Nested Structures**: Support for complex directory structures like `packages/my-app`
✅ **Shared Repos**: Multiple apps/plugins can share a single repository
✅ **Your Use Case**: Install both `node-app` and `wp-plugin` from the same repo

## Example Use Cases

### 1. Your Monorepo
```
jpollock/node-wp-app-for-local-addon/
├── node-app/          ← Node.js Express app
│   └── package.json
└── wp-plugin/         ← WordPress plugin
    └── plugin-name.php
```

### 2. Yarn Workspaces
```
my-monorepo/
├── packages/
│   ├── api/
│   │   └── package.json
│   └── frontend/
│       └── package.json
└── package.json
```

Use subdirectory: `packages/api` or `packages/frontend`

### 3. Nested Apps
```
project/
├── apps/
│   └── node-backend/
│       └── package.json
└── plugins/
    └── wp-integration/
        └── plugin.php
```

Use subdirectory: `apps/node-backend` or `plugins/wp-integration`

## Security

All subdirectory paths are validated with 4 layers of security:

1. **Zod Schema Validation**: Max 500 chars, valid characters only
2. **Path Traversal Prevention**: No `..` or leading `/` allowed
3. **Regex Validation**: Only `a-zA-Z0-9/_.-` allowed
4. **Existence Check**: Verifies subdirectory exists and is a directory

## Success!

The monorepo support UI is now complete. You can now:

1. **Add your Node.js app** from `node-app/` subdirectory
2. **Add your WordPress plugin** from `wp-plugin/` subdirectory
3. **Both from the same repository**: `https://github.com/jpollock/node-wp-app-for-local-addon.git`

No more "No package.json found" errors! 🎉

## Next Steps

1. Build the addon: `npm run build`
2. Restart Local
3. Add your Node app with `node-app` subdirectory
4. Add your WordPress plugin with `wp-plugin` subdirectory
5. Verify both work together

The Node.js app will have access to WordPress environment variables (WP_DB_HOST, WP_DB_NAME, etc.) and the WordPress plugin will be active and ready to use.
