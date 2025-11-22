# Development Guidelines for AI Agents

## Core Principles

1. **Security First**: All user input MUST be validated
2. **Performance Matters**: Don't block the UI thread
3. **Error Handling**: Graceful degradation, clear messages
4. **Code Quality**: Type-safe, well-documented, maintainable
5. **Git Hygiene**: Clear commits, proper branching, clean merges
6. **Test Coverage**: Write tests for new code
7. **Documentation**: Update docs with changes

---

## Git Workflow (CRITICAL - READ CAREFULLY)

### Branch Strategy

**Main Branches**:
- `main`: Production-ready code (DO NOT commit directly)
- `review-and-improve`: Active development (base your work here)

**Feature Branches**:
```bash
# Create feature branch from review-and-improve
git checkout review-and-improve
git pull origin review-and-improve
git checkout -b feature/A1-wordpress-env-vars

# Work on your changes...
# Commit frequently

# When ready to merge:
git checkout review-and-improve
git pull origin review-and-improve
git merge feature/A1-wordpress-env-vars
git push origin review-and-improve

# Delete feature branch
git branch -d feature/A1-wordpress-env-vars
```

### Commit Message Format

```
<type>: <description>

<optional body with details>
<optional breaking changes>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no functionality change)
- `test`: Add/update tests
- `docs`: Documentation only
- `chore`: Maintenance (deps, config, version bump)
- `perf`: Performance improvement
- `security`: Security fix/improvement

**Examples**:
```
feat: Add WordPress environment variables to Node.js apps

Automatically inject WP_HOME, DATABASE_URL, and other WordPress-specific
environment variables into Node.js apps. This makes it seamless for Node.js
apps to connect to the WordPress database and use WordPress URLs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix: Handle missing package.json gracefully

Previously crashed if package.json was missing during script detection.
Now shows helpful error message and continues with defaults.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Before Every Commit

```bash
# 1. Build successfully
npm run build

# 2. Fix any TypeScript errors
npm run type-check

# 3. Run tests (when available)
npm test

# 4. Check what you're committing
git status
git diff

# 5. Stage only relevant files
git add <specific-files>

# 6. Commit with clear message
git commit -m "feat: Your clear description"
```

### Merge Conflicts

If you encounter merge conflicts:

```bash
# 1. Pull latest changes
git checkout review-and-improve
git pull origin review-and-improve

# 2. Merge into your branch
git checkout feature/your-branch
git merge review-and-improve

# 3. Resolve conflicts
# Edit conflicting files, remove conflict markers
# Keep both changes if needed, or choose one

# 4. Test after resolving
npm run build
npm test

# 5. Commit the merge
git add .
git commit -m "chore: Merge review-and-improve into feature branch"

# 6. Continue development
```

---

## Code Quality Standards

### TypeScript

**DO**:
```typescript
// ✅ Explicit types
function addApp(site: Local.Site, config: AddAppRequest['app']): Promise<NodeApp> {
  // ...
}

// ✅ Interfaces for complex objects
interface WordPressEnvVars {
  WP_HOME: string;
  DATABASE_URL: string;
  // ...
}

// ✅ Type guards
function isNodeApp(obj: unknown): obj is NodeApp {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}

// ✅ Const assertions for literal types
const ALLOWED_COMMANDS = ['npm', 'yarn', 'pnpm', 'node'] as const;
```

**DON'T**:
```typescript
// ❌ Using any
function doSomething(data: any) { }

// ❌ Implicit any
function doSomething(data) { }

// ❌ Non-null assertions without validation
const app = apps.find(a => a.id === id)!;

// ❌ Type casting without checking
const site = data as Local.Site;
```

### Security - Input Validation

**ALL user input MUST be validated with Zod schemas**:

```typescript
// ✅ Good: Validate before processing
const validation = validate(AddAppRequestSchema, request);
if (!validation.success) {
  return {
    success: false,
    error: `Invalid request: ${validation.error}`
  };
}
const validatedRequest = validation.data;
// Now use validatedRequest safely
```

**Command Execution**:

```typescript
// ✅ Good: shell: false, validated args
const [command, ...args] = validatedCommand;
spawn(command, args, {
  shell: false,  // CRITICAL: prevents command injection
  cwd: validatedPath
});

// ❌ Bad: shell: true with user input
spawn(`${userCommand} ${userArgs}`, {
  shell: true  // DANGER: command injection!
});

// ❌ Bad: string concatenation
spawn('npm', [`install ${userPackage}`]);  // DANGER!

// ✅ Good: separate args
spawn('npm', ['install', userPackage]);
```

**Path Validation**:

```typescript
// ✅ Good: Validate paths
async function readAppFile(appId: string, filename: string): Promise<string> {
  // Validate appId is UUID
  if (!isValidUUID(appId)) {
    throw new Error('Invalid app ID');
  }

  // Validate filename doesn't contain path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }

  const appPath = path.join(sitePath, 'node-apps', appId);
  const filePath = path.join(appPath, filename);

  // Ensure filePath is within appPath (prevent traversal)
  if (!filePath.startsWith(appPath)) {
    throw new Error('Path traversal detected');
  }

  return await fs.readFile(filePath, 'utf-8');
}
```

### Error Handling

**Always handle errors gracefully**:

```typescript
// ✅ Good: Try-catch with user-friendly messages
try {
  await this.npmManager.install({ cwd: appPath });
} catch (error: unknown) {
  if (error instanceof Error) {
    return {
      success: false,
      error: `Failed to install dependencies: ${error.message}. Check logs at ${logPath}`
    };
  }
  return {
    success: false,
    error: 'Failed to install dependencies. Check logs for details.'
  };
}

// ✅ Good: Sanitize errors before showing to user
const sanitizedError = logAndSanitizeError(localLogger, 'Failed to add app', error);
return { success: false, error: sanitizedError };

// ❌ Bad: Exposing raw errors
return { success: false, error: error.stack }; // Leaks implementation details!

// ❌ Bad: Not handling errors
await this.npmManager.install({ cwd: appPath }); // Could throw!
```

**Log errors for debugging**:

```typescript
// ✅ Good: Log full error, show sanitized to user
try {
  // risky operation
} catch (error) {
  console.error('[NodeAppManager] Full error:', error);
  localLogger.error('Failed to start app', { error, appId });

  const userMessage = 'Failed to start app. Please check logs.';
  return { success: false, error: userMessage };
}
```

### Async/Await Best Practices

```typescript
// ✅ Good: Await promises
async function addApp(): Promise<NodeApp> {
  const result = await this.gitManager.clone(url);
  await this.npmManager.install(path);
  return app;
}

// ✅ Good: Parallel operations when possible
async function updateApp(): Promise<void> {
  await Promise.all([
    this.saveConfig(app),
    this.refreshUI(),
    this.notifyUser()
  ]);
}

// ❌ Bad: Not awaiting promises
async function addApp(): Promise<NodeApp> {
  this.gitManager.clone(url);  // Not awaited! Will fail silently
  this.npmManager.install(path);  // Not awaited!
  return app;
}

// ❌ Bad: Sequential when could be parallel
async function updateApp(): Promise<void> {
  await this.saveConfig(app);
  await this.refreshUI();  // Could run in parallel
  await this.notifyUser();  // Could run in parallel
}
```

### Performance

**Don't block the UI thread**:

```typescript
// ✅ Good: Use IPC for async operations
ipcMain.handle('node-orchestrator:add-app', async (event, request) => {
  // Long-running operation, but async so UI stays responsive
  const app = await appManager.addApp(site, appConfig);
  return { success: true, app };
});

// ✅ Good: Show progress for long operations
async cloneRepository(options: CloneOptions): Promise<CloneResult> {
  git.clone(url, path)
    .on('progress', (progress) => {
      if (options.onProgress) {
        options.onProgress({
          phase: 'cloning',
          progress: progress.percent,
          message: progress.stage
        });
      }
    });
}

// ❌ Bad: Synchronous blocking operations
const files = fs.readdirSync(largePath);  // Blocks!
const content = fs.readFileSync(file);  // Blocks!
```

**Optimize loops**:

```typescript
// ✅ Good: Break early when possible
function findApp(apps: NodeApp[], id: string): NodeApp | null {
  for (const app of apps) {
    if (app.id === id) return app;  // Found, stop searching
  }
  return null;
}

// ❌ Bad: Unnecessary work
function findApp(apps: NodeApp[], id: string): NodeApp | null {
  const filtered = apps.filter(app => app.id === id);  // Searches entire array
  return filtered[0] || null;
}
```

---

## Testing Requirements

### Unit Tests

**Every new function should have tests**:

```typescript
// src/lib/PortManager.ts
export class PortManager {
  async allocatePort(sitePath: string, appId: string): Promise<number> {
    // implementation
  }
}

// tests/unit/PortManager.test.ts
describe('PortManager', () => {
  let portManager: PortManager;

  beforeEach(() => {
    portManager = new PortManager();
  });

  describe('allocatePort', () => {
    it('should allocate port in range 3000-3999', async () => {
      const port = await portManager.allocatePort('/test/path', 'test-id');
      expect(port).toBeGreaterThanOrEqual(3000);
      expect(port).toBeLessThan(4000);
    });

    it('should not allocate same port twice', async () => {
      const port1 = await portManager.allocatePort('/test/path', 'id-1');
      const port2 = await portManager.allocatePort('/test/path', 'id-2');
      expect(port1).not.toBe(port2);
    });

    it('should throw when no ports available', async () => {
      // Allocate all ports
      for (let i = 0; i < 1000; i++) {
        await portManager.allocatePort('/test/path', `id-${i}`);
      }

      await expect(
        portManager.allocatePort('/test/path', 'overflow')
      ).rejects.toThrow('No ports available');
    });
  });
});
```

### Integration Tests

**Test IPC handlers**:

```typescript
// tests/integration/ipc-handlers.test.ts
describe('IPC Handlers', () => {
  it('should add app successfully', async () => {
    const request = {
      siteId: 'test-site',
      app: {
        name: 'test-app',
        gitUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        // ...
      }
    };

    const response = await ipcMain.handle('node-orchestrator:add-app', request);

    expect(response.success).toBe(true);
    expect(response.app.id).toBeDefined();
  });
});
```

### Test Coverage Goals

- **Manager Classes**: 80%+ coverage
- **IPC Handlers**: 80%+ coverage
- **Validation**: 90%+ coverage
- **Critical Paths**: 100% coverage

---

## Documentation Standards

### Code Comments

```typescript
/**
 * Allocate an available port for a Node.js app
 *
 * Scans ports 3000-3999 to find one that's not already allocated.
 * Persists allocation to prevent conflicts.
 *
 * @param sitePath - Absolute path to the Local site
 * @param appId - UUID of the Node.js app
 * @returns Allocated port number
 * @throws {Error} If no ports available in range
 *
 * @example
 * const port = await portManager.allocatePort('/Users/me/Local Sites/mysite', 'abc-123');
 * console.log(`Allocated port: ${port}`);
 */
async allocatePort(sitePath: string, appId: string): Promise<number> {
  // Implementation
}
```

### Inline Comments

```typescript
// ✅ Good: Explain WHY, not WHAT
// Use Local's bundled Node.js to ensure users don't need Node.js installed
if (command === 'node') {
  command = process.execPath;
}

// ✅ Good: Document complex logic
// Port allocation strategy:
// 1. Load existing allocations from JSON
// 2. Find lowest available port in range 3000-3999
// 3. Save allocation to prevent conflicts
// 4. Return allocated port

// ❌ Bad: Obvious comment
// Increment i
i++;

// ❌ Bad: Commented-out code (delete it instead)
// const oldApproach = () => { ... };
```

### Update Documentation

When adding a feature:
1. Update `CONTEXT.md` if architecture changes
2. Update `ROADMAP.md` to mark feature complete
3. Update `README.md` if user-facing
4. Add examples to `docs/EXAMPLES.md`
5. Update type definitions with JSDoc

---

## Code Review Checklist

Before submitting your work:

### Functionality
- [ ] Feature works as expected
- [ ] Edge cases handled
- [ ] Error cases handled
- [ ] No console errors/warnings

### Code Quality
- [ ] TypeScript strict mode passes
- [ ] No `any` types (or justified)
- [ ] Proper error handling
- [ ] Performance optimized
- [ ] No unnecessary complexity

### Security
- [ ] All inputs validated with Zod
- [ ] No command injection vulnerabilities
- [ ] No path traversal vulnerabilities
- [ ] Errors sanitized before showing to user
- [ ] `shell: false` for spawn() (unless explicitly needed)

### Testing
- [ ] Unit tests written
- [ ] Tests pass
- [ ] Coverage meets requirements
- [ ] Manual testing completed

### Documentation
- [ ] Code commented where needed
- [ ] Public APIs documented
- [ ] README updated if needed
- [ ] CONTEXT.md updated if architecture changed

### Git
- [ ] Clear commit messages
- [ ] Logical commits (not WIP/temp)
- [ ] No merge conflicts
- [ ] Branched from `review-and-improve`

---

## Common Patterns in This Codebase

### IPC Handler Pattern

```typescript
ipcMain.handle('node-orchestrator:action-name', async (_event, request: unknown) => {
  try {
    // 1. Validate input
    const validation = validate(ActionRequestSchema, request);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid request: ${validation.error}`
      };
    }

    const validatedRequest = validation.data;

    // 2. Get site
    const site = siteData.getSite(validatedRequest.siteId);
    if (!site) {
      throw new Error('Site not found');
    }

    // 3. Log action
    localLogger.info('Performing action', {
      siteId: validatedRequest.siteId,
      // ... relevant data
    });

    // 4. Perform action
    const result = await manager.doAction(site, validatedRequest);

    // 5. Log success
    localLogger.info('Action completed successfully', {
      siteId: validatedRequest.siteId
    });

    // 6. Return success
    return {
      success: true,
      data: result
    };

  } catch (error: unknown) {
    // 7. Log and sanitize error
    const sanitizedError = logAndSanitizeError(localLogger, 'Action failed', error);
    return {
      success: false,
      error: sanitizedError
    };
  }
});
```

### Manager Class Pattern

```typescript
export class SomeManager {
  // Dependencies injected via constructor
  constructor(
    private configManager: ConfigManager,
    private otherDependency: OtherManager
  ) {}

  // Public methods are async
  async publicMethod(params: ValidatedType): Promise<Result> {
    // Validate preconditions
    if (!params.required) {
      throw new Error('Missing required parameter');
    }

    // Call private methods
    const intermediate = await this.privateMethod(params);

    // Return result
    return this.formatResult(intermediate);
  }

  // Private methods for internal logic
  private async privateMethod(params: ValidatedType): Promise<Intermediate> {
    // Implementation
  }

  // Synchronous helpers
  private formatResult(data: Intermediate): Result {
    // Transform data
  }
}
```

### React UI Pattern (Current - createElement)

```typescript
// Current pattern (until React refactor)
React.createElement('div', { style: { padding: '20px' } },
  React.createElement('h3', null, 'Title'),
  React.createElement('p', null, 'Description'),
  React.createElement('button', {
    onClick: this.handleClick,
    style: { backgroundColor: '#007cba' }
  }, 'Click Me')
)
```

### Validation Schema Pattern

```typescript
// schemas.ts
const fieldSchema = z
  .string()
  .min(1, 'Field is required')
  .max(100, 'Field too long')
  .regex(/^[a-z0-9-]+$/, 'Invalid characters');

export const ActionRequestSchema = z.object({
  siteId: siteIdSchema,
  field: fieldSchema,
  optional: z.string().optional()
});

// Usage
const validation = validate(ActionRequestSchema, request);
if (!validation.success) {
  // Handle error
}
const { siteId, field, optional } = validation.data;
```

---

## Debugging Tips

### Enable Verbose Logging

```typescript
// Set environment variable
process.env.DEBUG = 'node-orchestrator:*';

// Add debug logs
console.log('[NodeAppManager] Starting app:', { appId, command, args });
```

### Check Logs

```bash
# App logs
tail -f ~/Local\ Sites/<site-name>/logs/node-apps/<app-id>.log

# Local's logs
tail -f ~/Library/Logs/local-by-flywheel/main.log
```

### Test in Isolation

```typescript
// Create test file
// test-npm-manager.ts
import { NpmManager } from './src/lib/NpmManager';

async function test() {
  const npm = new NpmManager();
  const info = await npm.getNpmInfo();
  console.log('npm info:', info);
}

test().catch(console.error);

// Run
npx ts-node test-npm-manager.ts
```

---

## Questions? Stuck?

1. **Check existing code** - Similar functionality probably exists
2. **Read Kitchen Sink addon** - Reference implementation
3. **Check CONTEXT.md** - Architecture details
4. **Review this guide** - Common patterns
5. **Test frequently** - Don't wait until the end
6. **Ask for clarification** - Better to ask than guess

---

## Remember

- **Security**: Validate all inputs, use `shell: false`, sanitize errors
- **Quality**: TypeScript strict, tests, documentation
- **Performance**: Async operations, don't block UI
- **Git**: Clear commits, proper branching, test before merging
- **Communication**: Update docs, clear error messages, log actions

**When in doubt, follow existing patterns in the codebase!**
