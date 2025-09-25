# Lessons Learned - Node.js Orchestrator Addon Development

## Critical Discoveries

### 1. React Hooks Don't Work in Local Addons

**Problem**: Using React hooks causes "Invalid hook call" error:
```tsx
// ❌ THIS FAILS
const MyComponent = () => {
  const [state, setState] = React.useState('');
  // Error: Invalid hook call. Hooks can only be called inside of the body of a function component
};
```

**Solution**: Use class components:
```tsx
// ✅ THIS WORKS
class MyComponent extends React.Component {
  state = { value: '' };
  render() {
    // Component logic
  }
}
```

**Why**: Local provides React via context, which can cause React instance conflicts that break hooks.

### 2. IPC Handler Registration Issues (UNRESOLVED)

**Problem**: "No handler registered for 'addon-name:command'" error

**Current Status**: IPC handlers appear in compiled code but don't actually register. This appears to be a caching or loading issue with Local.

**Attempted Solutions**:
```typescript
// ✅ Code compiles correctly
LocalMain.addIpcAsyncListener('addon:command', async (data) => {
  return { success: true, data };
});

// ❌ But handlers don't actually register at runtime
// Even with try/catch, no errors are thrown
// Local may be caching old version of main.js
```

**Workarounds Tried**:
- Version bumping package.json
- Renaming addon
- Adding extensive logging
- Wrapping in try/catch
- None have resolved the issue

### 3. Component Not Rendering

**Problem**: Component registered but not showing in UI

**Debugging Steps**:
1. Add console logging everywhere
2. Always render something (even "waiting for data")
3. Check you're viewing a site, not the dashboard
4. Log props to see what's being passed

**Solution**:
```tsx
const Component = (props) => {
  console.log('[Addon] Props:', props);
  const site = props?.site || props;

  // Always render something for debugging
  if (!site?.id) {
    return <div>Waiting for site data...</div>;
  }

  // Your actual component
};
```

### 4. Site Data Passed Directly as Props

**Discovery**: Site data is NOT passed as `props.site` but directly as props

**Wrong**:
```tsx
const NodeAppsInfo = ({ site }) => {
  // site will be undefined
}
```

**Correct**:
```tsx
const NodeAppsInfo = (props) => {
  // props IS the site object
  const site = props;
  // site.id, site.name, site.path, etc.
}
```

### 5. Debug Output is Essential

Add extensive logging during development:
```typescript
// Main process
localLogger.log('info', 'Handler registered');

// Renderer process
console.log('[Addon] Component called with:', props);
```

## Quick Debugging Checklist

When addon doesn't work:

1. ✅ Check `productName` exists in package.json
2. ✅ Run `npm run build` to compile TypeScript
3. ✅ Check Local logs: `~/Library/Logs/Local/local-lightning.log`
4. ✅ Open DevTools: View → Toggle Developer Tools
5. ✅ Look for your console.log statements
6. ✅ Verify you're viewing a site (not dashboard)
7. ✅ Check both `lib/main.js` and `lib/renderer.js` exist

## IPC Communication Pattern

```typescript
// main.ts
LocalMain.addIpcAsyncListener('node-orchestrator:test', async (data) => {
  localLogger.log('info', 'Received:', data);
  return { success: true, timestamp: new Date() };
});

// renderer.tsx
const electron = context.electron || (window as any).electron;
const response = await electron.ipcRenderer.invoke('node-orchestrator:test', {
  siteId: site.id
});
```

## Next Steps for Node.js Orchestrator

### Phase 1: Core Infrastructure ✅
- [x] Basic addon structure
- [x] IPC communication
- [x] UI component rendering
- [x] Test suite

### Phase 2: Process Management (Next)
- [ ] Start/stop Node.js processes
- [ ] Port management (avoid conflicts)
- [ ] Process monitoring
- [ ] Log streaming

### Phase 3: App Templates
- [ ] Express.js template
- [ ] Next.js template
- [ ] Custom script support
- [ ] Environment variable management

### Phase 4: UI Enhancement
- [ ] Process status indicators
- [ ] Start/stop buttons
- [ ] Log viewer
- [ ] Port configuration

### Phase 5: Advanced Features
- [ ] Auto-start with site
- [ ] Process health checks
- [ ] Resource monitoring
- [ ] Multi-app support per site

## Development Tips

1. **Use TypeScript `any` liberally** - Local's types can be problematic
2. **Build frequently** - `npm run build` after every change
3. **Restart Local** - Some changes require full restart
4. **Check both logs** - DevTools console AND Local logs
5. **Start minimal** - Get basic features working first

## Known Gotchas

1. **React hooks don't work** - Use class components
2. **Site data comes as props directly** - Not as props.site
3. **IPC registration can fail silently** - Even if code is correct
4. **Local caches aggressively** - Hard to force reload of addons
5. **Build step is mandatory** - TypeScript must compile to JavaScript
6. **productName is required** - Addon won't load without it

## Current Blockers (September 2025)

1. **IPC Handler Registration** - Handlers in code but not registering at runtime
   - Appears to be Local caching issue
   - No clear error messages
   - Version bumping doesn't force reload

2. **Local Addon Caching** - Changes to main.js don't always reload
   - Requires complete Local restart
   - Sometimes requires removing/re-adding symlink
   - No documented cache clearing method

## Testing Strategy

```bash
# Build and test cycle
npm run build
npm test

# Watch mode for development
npm run watch

# Check the built files
ls -la lib/
```

## Resources

- Local logs: `~/Library/Logs/Local/local-lightning.log`
- DevTools: View → Toggle Developer Tools
- Addon location: `~/Library/Application Support/Local/addons/`
- Documentation: `/local-addon-documentation/docs/`