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

### 2. IPC Handler Registration Issues (✅ RESOLVED)

**Problem**: "No handler registered for 'addon-name:command'" error

**Root Cause**: Used non-existent `LocalMain.addIpcAsyncListener()` method. Local addons should use Electron's native IPC API directly.

**Solution**:
```typescript
// ❌ WRONG - This method doesn't exist
LocalMain.addIpcAsyncListener('addon:command', async (data) => {
  return { success: true, data };
});

// ✅ CORRECT - Use Electron's ipcMain directly
import { ipcMain } from 'electron';

ipcMain.handle('node-orchestrator:test', async (_event, request: unknown) => {
  try {
    // Validate input
    const validation = validate(RequestSchema, request);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // Process request
    const result = await doWork(validation.data);
    return { success: true, ...result };
  } catch (error: unknown) {
    const sanitizedError = logAndSanitizeError(localLogger, 'Operation failed', error);
    return { success: false, error: sanitizedError };
  }
});
```

**Key Takeaways**:
- Always use `ipcMain.handle()` from 'electron' package
- Parameters: `_event` (unused), `request: unknown` (validate before use)
- Always return `{ success: boolean, ... }` response format
- Wrap in try/catch with error sanitization
- Type request parameter as `unknown` and validate

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

## Security Best Practices (Implemented)

### 1. Input Validation with Zod

**Why**: Untrusted data from renderer process must be validated before use.

**Implementation**:
```typescript
import { z } from 'zod';

// Define schema
export const AddAppRequestSchema = z.object({
  siteId: z.string().uuid(),
  app: z.object({
    name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    gitUrl: z.string().url(),
    startCommand: z.string().min(1).max(500),
    // ... more fields
  })
});

// Validate in handler
const validation = validate(AddAppRequestSchema, request);
if (!validation.success) {
  return { success: false, error: validation.error };
}
```

**Benefits**:
- Type-safe validated data
- Clear error messages for invalid input
- Prevents injection attacks at the boundary
- Self-documenting API

### 2. Command Validation (Whitelist-Based)

**Why**: User-provided commands can enable shell injection attacks.

**Implementation**:
```typescript
const AllowedCommands = {
  npm: ['start', 'run', 'install', 'build', 'test', 'dev', 'ci'],
  yarn: ['start', 'run', 'install', 'build', 'test', 'dev'],
  pnpm: ['start', 'run', 'install', 'build', 'test', 'dev'],
  node: true,
  bun: ['start', 'run', 'install', 'build', 'test', 'dev'],
} as const;

export function validateCommand(command: string): CommandValidationResult {
  // Check for dangerous characters: ; & | ` $ ( ) < > \ " '
  const dangerousChars = /[;&|`$()<>\\'"]/;
  if (dangerousChars.test(command)) {
    return { valid: false, error: 'Dangerous characters detected' };
  }

  const [executable, ...args] = command.split(/\s+/);

  // Validate executable is in whitelist
  if (!AllowedCommands[executable]) {
    return { valid: false, error: `Executable '${executable}' not allowed` };
  }

  // Validate subcommands
  // ...

  return { valid: true, sanitizedCommand: [executable, ...args] };
}
```

**Key Points**:
- Whitelist > Blacklist (easier to secure)
- Block dangerous characters entirely
- Return sanitized command array for spawn()
- Use `shell: false` when spawning processes

### 3. Path Traversal Protection

**Why**: User-provided paths can escape intended directories.

**Implementation**:
```typescript
export function validatePath(
  basePath: string,
  targetPath: string,
  pathDescription: string = 'path'
): PathValidationResult {
  // Check for null bytes
  if (targetPath.includes('\0')) {
    return { valid: false, error: 'Null bytes detected' };
  }

  // Construct and resolve full path
  const fullPath = path.join(basePath, targetPath);
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(basePath);

  // Ensure resolved path is within base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) &&
      resolvedPath !== resolvedBase) {
    return { valid: false, error: 'Path traversal detected' };
  }

  return { valid: true, sanitizedPath: resolvedPath };
}
```

**Key Points**:
- Use `path.resolve()` to handle `..` and symlinks
- Check resolved path still within base directory
- Block null bytes (can bypass some filters)
- Validate app IDs separately (no path separators)

### 4. Error Sanitization

**Why**: Raw error messages leak sensitive system information.

**Implementation**:
```typescript
const SENSITIVE_PATTERNS = [
  /\/Users\/[^/\s]+/g,           // macOS user paths
  /\/home\/[^/\s]+/g,            // Linux user paths
  /C:\\Users\\[^\\s]+/g,         // Windows user paths
  /process\.env\.[A-Z_]+/g,     // Environment variables
  /\s+at\s+.+\(.+:\d+:\d+\)/g,  // Stack traces
];

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function logAndSanitizeError(
  logger: any,
  context: string,
  error: unknown
): string {
  // Log full error server-side for debugging
  logger.error(context, { error });

  // Return sanitized message for client
  return getErrorMessage(error);
}
```

**Key Points**:
- Log full errors server-side only
- Remove paths, env vars, stack traces from client errors
- Generic fallback message for unknown errors
- Maintain debugging capability without exposing details

## Summary of Resolutions

| Issue | Status | Solution |
|-------|--------|----------|
| IPC Registration | ✅ RESOLVED | Use `ipcMain.handle()` not LocalMain |
| React Hooks | ✅ RESOLVED | Convert to class components |
| Command Injection | ✅ RESOLVED | Whitelist validation + shell: false |
| Path Traversal | ✅ RESOLVED | path.resolve() + boundary checks |
| Input Validation | ✅ RESOLVED | Zod schemas on all IPC |
| Error Leakage | ✅ RESOLVED | Sanitization before client return |

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

### Debugging
- Local logs: `~/Library/Logs/Local/local-lightning.log`
- DevTools: View → Toggle Developer Tools
- Addon location: `~/Library/Application Support/Local/addons/`
- Documentation: `/local-addon-documentation/docs/`

### Security References
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Command Injection: https://owasp.org/www-community/attacks/Command_Injection
- Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
- Zod Documentation: https://zod.dev/

### Code Examples
- `src/security/validation.ts` - Command and path validation
- `src/security/schemas.ts` - Zod input validation
- `src/security/errors.ts` - Error sanitization
- `src/main-full.ts` - Complete IPC handler pattern

---

**Last Updated**: November 21, 2025
**Status**: All critical issues resolved, security hardened, ready for Phase 2