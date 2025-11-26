# Testing Guide - Monorepo with Node App + WordPress Plugin

## 🎯 Your Use Case

**Repository**: https://github.com/jpollock/node-wp-app-for-local-addon.git

**Structure**:
```
node-wp-app-for-local-addon/
├── node-app/          # Node.js Express service
│   ├── package.json
│   ├── src/
│   └── tsconfig.json
└── wp-plugin/         # WordPress plugin
    └── node-service-bridge.php
```

**Goal**:
1. Add the Node.js app from the `node-app/` subdirectory
2. Install the WordPress plugin from the `wp-plugin/` subdirectory

---

## ✅ Step 1: Add the Node.js App (With Monorepo Support)

### In Local's Node Orchestrator UI:

1. Click **"Add App"** or **"Add Node.js App"**

2. Fill in the form:
   - **Name**: `node-service`
   - **Git URL**: `https://github.com/jpollock/node-wp-app-for-local-addon.git`
   - **Branch**: `main` (or `master` if that's your default)
   - **Subdirectory**: `node-app` ⭐ (This is the key!)
   - **Install Command**: Leave empty (will auto-detect)
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Auto Start**: Check if you want it to start with site
   - **Inject WordPress Environment**: ✅ Keep checked

3. Click **"Add"** or **"Install"**

### What Should Happen:

1. ✅ Repository clones
2. ✅ Navigates into `node-app/` subdirectory
3. ✅ Runs `npm install` in the subdirectory
4. ✅ Runs `npm run build` (compiles TypeScript)
5. ✅ App is ready to start

### Check Installation:

```bash
# Find your site directory
ls ~/Local\ Sites/<your-site-name>/node-apps/

# Should see a directory with a UUID
# Inside should be the cloned repo with node-app/ subdirectory

# Check if it worked:
ls ~/Local\ Sites/<your-site-name>/node-apps/<app-id>/node-app/
# Should see: package.json, node_modules/, dist/, etc.
```

### Check Logs:

```bash
# View app logs
tail -f ~/Local\ Sites/<your-site-name>/logs/node-apps/<app-id>.log
```

**Expected in logs**:
```
=== Starting app at 2024-11-23T15:00:00.000Z ===
Working directory: /path/to/site/node-apps/<id>/node-app
...
WP_DB_HOST: localhost
WP_DB_NAME: local
WP_DB_USER: root
WP_SITE_URL: http://yoursite.local
...
```

### If It Works:
- ✅ App starts successfully
- ✅ WordPress environment variables are injected
- ✅ Express server is running on allocated port
- ✅ Can visit `http://localhost:<port>` to see the API

---

## ❌ Step 2: Install the WordPress Plugin (NO UI YET!)

**Problem**: There's no UI for WordPress plugin installation yet.

**Current Status**: Backend is 100% complete, but needs UI (Phase 4 work)

### Option A: Install Plugin via Browser Console (Advanced)

1. Open Local
2. Open your WordPress site
3. Go to **View → Developer → JavaScript Console**
4. Run this code:

```javascript
// First, get your site ID
// You can find it in the Local app or from the app config
// Let's try to get it from the context
const siteId = 'YOUR_SITE_ID'; // Replace with actual site ID

// Install the plugin
const result = await window.context.electron.ipcRenderer.invoke(
  'node-orchestrator:install-plugin',
  {
    siteId: siteId,
    plugin: {
      name: 'Node Service Bridge',
      gitUrl: 'https://github.com/jpollock/node-wp-app-for-local-addon.git',
      branch: 'main',
      subdirectory: 'wp-plugin',
      slug: 'node-service-bridge',
      autoActivate: true
    }
  }
);

console.log('Plugin installation result:', result);
```

**What this does**:
1. Clones your repo (again)
2. Extracts the `wp-plugin/` subdirectory
3. Copies it to `wp-content/plugins/node-service-bridge/`
4. Activates it via WP-CLI

### Option B: Manual Plugin Installation (Workaround)

Since there's no UI yet, you can install the plugin manually:

```bash
# Navigate to your WordPress plugins directory
cd ~/Local\ Sites/<your-site-name>/app/public/wp-content/plugins/

# Clone just the plugin subdirectory
git clone https://github.com/jpollock/node-wp-app-for-local-addon.git temp-clone
cp -r temp-clone/wp-plugin node-service-bridge
rm -rf temp-clone

# Verify it's there
ls -la node-service-bridge/
```

Then activate in WordPress admin:
1. Go to WordPress Admin → Plugins
2. Find "Node Service Bridge"
3. Click "Activate"

---

## ✅ Step 3: Verify Integration Works

Once both are installed:

### Test Node.js App:

1. **Check it's running**:
   ```bash
   # Check logs
   tail -f ~/Local\ Sites/<your-site-name>/logs/node-apps/<app-id>.log
   ```

2. **Test the API**:
   ```bash
   # Find the port (check logs or Local UI)
   curl http://localhost:<port>/
   ```

3. **Verify WordPress env vars**:
   - Check logs for `WP_DB_HOST`, `WP_SITE_URL`, etc.
   - App should be able to connect to WordPress database

### Test WordPress Plugin:

1. **Check it's active**:
   - Go to WordPress Admin → Plugins
   - "Node Service Bridge" should show as "Active"

2. **Test plugin functionality**:
   - The plugin appears to provide integration between WP and Node
   - Check if it shows any admin pages or settings

---

## 🔍 Troubleshooting

### Issue: Subdirectory not found

**Error**: `Subdirectory not found: node-app`

**Solutions**:
1. Verify branch name is correct (`main` vs `master`)
2. Check spelling of subdirectory path
3. Ensure subdirectory exists in the repo

### Issue: npm install fails

**Error**: `Failed to install dependencies`

**Solutions**:
1. Check logs for specific npm error
2. Verify package.json exists in subdirectory
3. Try with empty install command (auto-detect)

### Issue: TypeScript build fails

**Error**: `Build failed` or TypeScript errors

**Solutions**:
1. Check if TypeScript is in devDependencies
2. Verify tsconfig.json is correct
3. Check build logs for specific errors

### Issue: WordPress env vars not showing

**Symptom**: Process.env.WP_DB_HOST is undefined

**Solutions**:
1. Verify "Inject WordPress Environment" is checked
2. Check that Local site object has database info
3. Look for extraction errors in logs
4. Try logging all environment variables to see what's there

### Issue: Plugin not found in WordPress

**Symptom**: Plugin doesn't appear in WordPress admin

**Solutions**:
1. Check plugin was copied to correct directory:
   ```bash
   ls ~/Local\ Sites/<site>/app/public/wp-content/plugins/node-service-bridge/
   ```
2. Verify main PHP file has WordPress plugin headers
3. Check file permissions
4. Try manual installation (Option B above)

---

## 🎯 Success Criteria

### Node.js App ✅
- [ ] App installs from monorepo subdirectory
- [ ] npm install runs successfully
- [ ] TypeScript builds (npm run build)
- [ ] App starts without errors
- [ ] WordPress environment variables are present in process.env
- [ ] Can connect to WordPress database using injected credentials
- [ ] Express API responds on allocated port

### WordPress Plugin ✅
- [ ] Plugin files copied to wp-content/plugins/
- [ ] Plugin appears in WordPress admin
- [ ] Plugin can be activated
- [ ] Plugin functionality works (if applicable)

### Integration ✅
- [ ] Node app and WordPress plugin can communicate
- [ ] Node app has access to WordPress database
- [ ] All features work together

---

## 📝 What to Report Back

After testing, please share:

1. **Node App Status**:
   - ✅ or ❌ Did it install?
   - ✅ or ❌ Did it start?
   - ✅ or ❌ Are WP env vars present?
   - Share any errors from logs

2. **WordPress Plugin Status**:
   - ✅ or ❌ How did you install it? (Console or Manual)
   - ✅ or ❌ Does it appear in WP admin?
   - ✅ or ❌ Is it active?

3. **Any Errors**: Copy full error messages

---

## 💡 Known Limitations

1. **WordPress Plugin UI**: Not implemented yet (Phase 4)
   - Workaround: Use browser console or manual installation

2. **Subdirectory UI Field**: May not be visible in current UI
   - If missing: UI needs update to show subdirectory field

3. **Working Directory**: NodeAppManager needs final integration
   - Impact: App might start from wrong directory
   - Status: 90% complete, may need fix

---

## 🚀 Next Steps After Testing

Based on your test results, we can:

1. **Fix any bugs** you encounter
2. **Complete the WordPress Plugin UI** (2-3 hours)
3. **Add subdirectory field to UI** if missing (1 hour)
4. **Improve error messages** based on your experience

Let me know what happens! 🎉
