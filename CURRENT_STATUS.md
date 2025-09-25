# Node.js Orchestrator Addon - Current Status

## Date: September 17, 2025

## ✅ What's Working

### UI/Renderer
- ✅ Component renders successfully in Site Overview
- ✅ Receives site data (id, name, path, domain, etc.)
- ✅ Shows site-specific information
- ✅ Test IPC button displays correctly
- ✅ No React hooks errors (using class components)

### Main Process
- ✅ Addon loads successfully
- ✅ Shows up in Local's addon list
- ✅ Site lifecycle hooks work (siteStarted, siteStopping)
- ✅ Logging works correctly

## ❌ Current Issues

### IPC Communication
- ❌ IPC handlers not registering despite being in compiled code
- ❌ "No handler registered for 'node-orchestrator:test'" error
- ❌ Possible caching issue with Local not reloading main.js

## 📁 File Structure

```
local-addon-node-orchestrator/
├── src/
│   ├── main.ts              # Simple main process (IPC not working)
│   ├── renderer.tsx          # Working UI component
│   ├── main-simple.ts        # Backup minimal version
│   ├── renderer-simple.tsx   # Backup minimal version
│   └── lib/
│       └── ProcessManager.ts # Complete process management (not integrated)
├── lib/                      # Compiled JavaScript
├── test-app/
│   └── server.js            # Test Node.js application
├── package.json             # v1.0.2
├── tsconfig.json
├── jest.config.js
├── LESSONS_LEARNED.md
├── ROADMAP.md
└── VERSION
```

## 🔄 Current State Details

### Working Code (renderer.tsx)
- Site data comes directly as props, NOT as props.site
- Component successfully displays with site name and domain
- Class component pattern works (no hooks)

### Problematic Code (main.ts)
- IPC handler registration code is correct
- Compiles without errors
- Logs show addon loads
- But IPC handlers don't actually register

### Process Management (Not Integrated)
- Complete ProcessManager class written
- Can spawn/kill Node.js processes
- Port management implemented
- Event system for status updates
- Ready to integrate once IPC works

## 🐛 Debugging Attempts

1. **Version bumping** - Changed to v1.0.2, didn't force reload
2. **Renaming addon** - Tried node-orchestrator-v2, caused other issues
3. **Try/catch on IPC** - Added error handling, no errors thrown
4. **Multiple hook locations** - UI works with multiple hooks
5. **Console logging** - Extensive logging added everywhere

## 🎯 Next Steps (When Resumed)

1. **Fix IPC Registration**
   - Try using electron's ipcMain directly
   - Check if LocalMain.addIpcAsyncListener has requirements
   - Investigate Local's addon loading cache

2. **Integrate Process Management**
   - Once IPC works, connect ProcessManager
   - Add start/stop UI buttons
   - Implement log streaming

3. **Complete Features**
   - Port management UI
   - Process status indicators
   - Auto-start on site launch

## 💡 Key Discoveries

1. **Site data is passed directly as props**, not nested
2. **React hooks don't work** - must use class components
3. **Local caches aggressively** - hard to force reload
4. **UI hooks work perfectly** - multiple locations available
5. **IPC registration is problematic** - unclear why

## 📝 Configuration

### Symlink Location
```bash
~/.config/Local/addons/local-addon-node-orchestrator ->
  /home/jeremy/development/professional/wpe/local/addons/local-addon-node-orchestrator
```

### Build Command
```bash
npm run build
```

### Test Site
- Name: noemi.org
- ID: WV_rXBGqk
- Path: ~/Local Sites/noemiorg
- Domain: noemiorg.local

## 🔧 To Resume Work

1. Check Local logs for v1.0.2 messages
2. If IPC still not working, try:
   - Remove symlink, readd
   - Clear Local's cache
   - Try different IPC registration method
3. Once IPC works, integrate ProcessManager
4. Test with test-app/server.js

## 📚 Related Documentation

- LESSONS_LEARNED.md - Critical discoveries and gotchas
- ROADMAP.md - Full feature plan with 8 phases
- test-app/server.js - Ready-to-use test Node server

---

**Current Blocker**: IPC handlers not registering despite correct code
**Last Action**: Version bumped to 1.0.2, added logging
**Ready to Pivot**: Yes, current state documented