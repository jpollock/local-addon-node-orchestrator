# Node.js Orchestrator - Optimized Execution Plan

## 🎯 Executive Summary

This execution plan optimizes the roadmap for **real-world development constraints** while maintaining the three distinguishing features. Based on my analysis of the codebase, I've reorganized the work into **4 phases with 3-4 parallel work streams per phase**, designed for a team of 3-4 developers working concurrently.

**Key Changes from Original Roadmap**:
1. **Reduced parallelization** from 9 agents to 3-4 (more realistic)
2. **Reordered priorities** based on dependencies and risk
3. **Added integration checkpoints** to prevent merge conflicts
4. **Incorporated testing into each phase** (not deferred)
5. **Faster time-to-value** for distinguishing features

---

## 📊 Project Health Check

**Current State Analysis**:
- ✅ Solid foundation: 2.0.0 with hybrid npm support
- ✅ Security architecture in place (Zod validation, command sanitization)
- ✅ Core managers implemented (Git, Config, Port, Npm, NodeApp)
- ⚠️ Tests exist but limited coverage
- ⚠️ No WordPress integration yet (main differentiator!)
- ⚠️ React UI uses createElement (not modern)
- ⚠️ No monorepo support yet

**Risk Assessment**:
- 🔴 **HIGH RISK**: WordPress integration (core differentiator, complex, many unknowns)
- 🟡 **MEDIUM RISK**: Monorepo support (path validation critical for security)
- 🟡 **MEDIUM RISK**: React refactor (could introduce regressions)
- 🟢 **LOW RISK**: Script detection, error messages (isolated changes)

**Strategy**: De-risk high-priority features first, test continuously, integrate frequently.

---

## 🏗️ Architecture Decisions

### 1. WordPress Integration Architecture

**Decision**: Create a new `WordPressIntegrationManager` that orchestrates both environment variables and plugin management.

**Rationale**:
- Single source of truth for WordPress interactions
- Easier to test in isolation
- Can be extended for future WP features (WP-CLI, REST API)

**Structure**:
```
src/lib/wordpress/
├── WordPressIntegrationManager.ts   # Main coordinator
├── WordPressEnvManager.ts            # Extract WP env vars from Local site
├── WordPressPluginManager.ts         # Install/activate WP plugins
└── WpCliManager.ts                   # WP-CLI command execution
```

### 2. Monorepo Support Architecture

**Decision**: Add `subdirectory` field to `NodeApp` interface, validate at multiple levels.

**Security Layers**:
1. **Input validation**: Zod schema prevents path traversal patterns
2. **Filesystem validation**: Verify subdirectory exists and is within repo
3. **Package.json validation**: Ensure subdirectory has package.json (for Node apps)
4. **Working directory isolation**: All operations scoped to subdirectory

### 3. Testing Strategy

**Decision**: Write tests alongside features (not after), minimum 70% coverage per PR.

**Test Pyramid**:
- **Unit tests** (70%): Manager classes, pure functions
- **Integration tests** (20%): IPC handlers, file operations
- **E2E tests** (10%): Full workflows in mock Local environment

### 4. Git Workflow

**Decision**: All work branches from `sculptor/add-wp-env-auto-injection` (current branch), merge back to it, then eventually to `review-and-improve`.

**Why**: The current branch already has context documents, so we continue from here.

---

## 🚀 Phase 1: WordPress Integration Foundation (Week 1-2)

**Goal**: Implement the three distinguishing features in order of risk (highest first)

**Team Size**: 3 developers working in parallel

### Work Stream 1.1: WordPress Environment Variables (Priority: CRITICAL)

**Owner**: Backend Integration Specialist
**Duration**: 3-4 days
**Risk**: HIGH (core differentiator, depends on Local's site structure)

#### Tasks:
1. **Day 1: Research & Setup**
   - [ ] Study Local's site object structure (inspect real Local sites)
   - [ ] Find where Local stores database credentials
   - [ ] Determine if Local exposes site URL, admin URL via API
   - [ ] Create `src/lib/wordpress/` directory
   - [ ] Write `WordPressEnvManager.ts` skeleton

2. **Day 2: Implementation**
   - [ ] Implement `extractWordPressEnv(site: Local.Site): WordPressEnv`
   - [ ] Parse Local's site object to get DB credentials:
     - `WP_DB_HOST`, `WP_DB_NAME`, `WP_DB_USER`, `WP_DB_PASSWORD`
   - [ ] Parse site URLs:
     - `WP_SITE_URL` (e.g., `http://mysite.local`)
     - `WP_HOME_URL`, `WP_ADMIN_URL`
   - [ ] Parse file paths:
     - `WP_CONTENT_DIR`, `WP_UPLOADS_DIR`
   - [ ] Add interface:
     ```typescript
     interface WordPressEnv {
       WP_DB_HOST: string;
       WP_DB_NAME: string;
       WP_DB_USER: string;
       WP_DB_PASSWORD: string;
       WP_SITE_URL: string;
       WP_HOME_URL: string;
       WP_ADMIN_URL: string;
       WP_CONTENT_DIR: string;
       WP_UPLOADS_DIR: string;
       DATABASE_URL?: string; // Optional: Full connection string
     }
     ```

3. **Day 3: Integration**
   - [ ] Modify `NodeApp` interface to add `injectWpEnv: boolean` (default: true)
   - [ ] Update `AddAppRequestSchema` in `schemas.ts`
   - [ ] Modify `NodeAppManager.startApp()`:
     - Call `WordPressEnvManager.extractWordPressEnv(site)`
     - Merge WP env vars with app's custom env vars
     - Pass merged env to `spawn()`
   - [ ] Add logging (sanitize credentials!)
   - [ ] Update UI: Add checkbox "Inject WordPress Environment Variables"

4. **Day 4: Testing & Polish**
   - [ ] Unit tests: `WordPressEnvManager.test.ts`
     - Mock Local.Site object
     - Test env extraction
     - Test credential sanitization in logs
   - [ ] Integration test: Start app with WP env vars
   - [ ] Manual test: Create test Node.js app that connects to WP database
   - [ ] Security review: Ensure no credentials leaked

#### Success Criteria:
- [ ] Node.js apps can connect to WordPress DB using injected env vars
- [ ] Credentials never appear in logs or UI
- [ ] Tests achieve 80%+ coverage
- [ ] Feature documented in README

#### Files Created/Modified:
- `src/lib/wordpress/WordPressEnvManager.ts` (NEW)
- `src/types.ts` (add `WordPressEnv` interface)
- `src/lib/NodeAppManager.ts` (modify `startApp()`)
- `src/security/schemas.ts` (add `injectWpEnv` field)
- `src/renderer.tsx` (add UI checkbox)
- `tests/unit/WordPressEnvManager.test.ts` (NEW)

---

### Work Stream 1.2: Monorepo Support (Priority: HIGH)

**Owner**: Git & File System Specialist
**Duration**: 3-4 days
**Risk**: MEDIUM (path validation critical for security)

#### Tasks:
1. **Day 1: Design & Validation**
   - [ ] Add `subdirectory?: string` to `NodeApp` interface
   - [ ] Create Zod schema for subdirectory validation:
     ```typescript
     const subdirectorySchema = z
       .string()
       .max(500, 'Subdirectory path too long')
       .regex(/^[a-zA-Z0-9/_.-]+$/, 'Invalid characters in subdirectory')
       .refine(
         (path) => !path.includes('..') && !path.startsWith('/'),
         'Path traversal detected'
       )
       .optional();
     ```
   - [ ] Add to `AddAppRequestSchema`
   - [ ] Write unit tests for path validation (including attack vectors)

2. **Day 2: Git Integration**
   - [ ] Modify `GitManager.cloneRepository()` to accept subdirectory param
   - [ ] After clone, verify subdirectory exists:
     ```typescript
     const subdirPath = path.join(clonePath, subdirectory);
     if (!await fs.pathExists(subdirPath)) {
       throw new Error(`Subdirectory not found: ${subdirectory}`);
     }
     ```
   - [ ] Verify subdirectory is within cloned repo (prevent traversal):
     ```typescript
     const resolvedPath = path.resolve(subdirPath);
     const resolvedClonePath = path.resolve(clonePath);
     if (!resolvedPath.startsWith(resolvedClonePath)) {
       throw new Error('Path traversal detected');
     }
     ```
   - [ ] Check for package.json in subdirectory (for Node apps)

3. **Day 3: Manager Integration**
   - [ ] Modify `NodeAppManager.addApp()`:
     - Use subdirectory as working directory for npm install
     - Use subdirectory as working directory for build
   - [ ] Modify `NodeAppManager.startApp()`:
     - Start app from subdirectory (set `cwd` in spawn)
   - [ ] Update `ConfigManager` to persist subdirectory field
   - [ ] Add helper method: `getAppWorkingDirectory(app: NodeApp): string`

4. **Day 4: UI & Testing**
   - [ ] Add UI field: "Subdirectory (optional)" with placeholder
   - [ ] Add inline validation for subdirectory field
   - [ ] Integration tests:
     - Test monorepo with subdirectory
     - Test nested subdirectories (e.g., `apps/backend/api`)
     - Test path traversal attempts (should fail)
     - Test non-existent subdirectories (should fail)
   - [ ] Manual test: Clone real monorepo (e.g., Turborepo example)

#### Success Criteria:
- [ ] Can clone repo and use app from subdirectory
- [ ] Path traversal attempts blocked
- [ ] Security audit passes
- [ ] Tests achieve 80%+ coverage

#### Files Created/Modified:
- `src/types.ts` (add `subdirectory` field)
- `src/security/schemas.ts` (add subdirectory validation)
- `src/lib/GitManager.ts` (modify `cloneRepository()`)
- `src/lib/NodeAppManager.ts` (modify `addApp()`, `startApp()`)
- `src/renderer.tsx` (add UI field)
- `tests/unit/subdirectory-validation.test.ts` (NEW)
- `tests/integration/monorepo.test.ts` (NEW)

---

### Work Stream 1.3: WordPress Plugin Management (Priority: HIGH)

**Owner**: WordPress Integration Specialist
**Duration**: 5-6 days
**Risk**: HIGH (depends on WP-CLI, complex workflows)

**Dependencies**: Starts after 1.2 completes (needs subdirectory support)

#### Tasks:
1. **Day 1: WP-CLI Research**
   - [ ] Locate WP-CLI binary in Local (check Kitchen Sink addon)
   - [ ] Test WP-CLI commands manually:
     ```bash
     /path/to/wp plugin list --path=/path/to/site
     /path/to/wp plugin activate my-plugin --path=/path/to/site
     ```
   - [ ] Document WP-CLI path resolution strategy
   - [ ] Create `WpCliManager.ts` to wrap WP-CLI commands

2. **Day 2: WpCliManager Implementation**
   - [ ] Implement `WpCliManager.execute(site, command, args)`:
     - Resolve WP-CLI path
     - Validate command against whitelist
     - Spawn WP-CLI process with `shell: false`
     - Parse output (JSON format preferred)
   - [ ] Add helper methods:
     - `listPlugins(site): Promise<Plugin[]>`
     - `activatePlugin(site, slug): Promise<void>`
     - `deactivatePlugin(site, slug): Promise<void>`
     - `getPluginInfo(site, slug): Promise<PluginInfo>`
   - [ ] Write unit tests for command validation

3. **Day 3: WordPressPluginManager Implementation**
   - [ ] Create `WordPressPluginManager.ts`:
     ```typescript
     interface WordPressPlugin {
       id: string;
       name: string;
       gitUrl: string;
       branch: string;
       subdirectory?: string;
       slug: string; // Directory name in wp-content/plugins
       status: 'installing' | 'installed' | 'active' | 'error';
       installedPath: string;
       createdAt: Date;
     }
     ```
   - [ ] Implement `installPlugin(site, config)`:
     - Clone Git repo to temp directory
     - Copy plugin files to `wp-content/plugins/{slug}`
     - If subdirectory specified, copy only that subdirectory
     - Validate plugin has required files (main PHP file)
   - [ ] Implement `activatePlugin(site, slug)`:
     - Use `WpCliManager.activatePlugin()`
   - [ ] Implement `removePlugin(site, slug)`:
     - Deactivate first
     - Delete plugin directory

4. **Day 4-5: IPC & UI Integration**
   - [ ] Add IPC handlers:
     - `node-orchestrator:install-plugin`
     - `node-orchestrator:activate-plugin`
     - `node-orchestrator:deactivate-plugin`
     - `node-orchestrator:remove-plugin`
     - `node-orchestrator:get-plugins`
   - [ ] Add Zod schemas for plugin requests
   - [ ] Store plugin configs in JSON (same file as apps)
   - [ ] Add UI section: "WordPress Plugins"
     - List of installed plugins
     - Add plugin form (similar to Add App)
     - Activate/deactivate toggles
     - Remove button

5. **Day 6: Testing & Documentation**
   - [ ] Unit tests: WP-CLI command validation
   - [ ] Integration tests: Install plugin, activate, deactivate
   - [ ] E2E test: Full plugin workflow
   - [ ] Manual test with real WordPress plugin repo
   - [ ] Document plugin installation in README
   - [ ] Add example plugin repos for testing

#### Success Criteria:
- [ ] Can install WordPress plugin from Git
- [ ] Can activate/deactivate plugin via WP-CLI
- [ ] Plugins survive Local restart
- [ ] Monorepo plugins work correctly
- [ ] Tests achieve 75%+ coverage

#### Files Created/Modified:
- `src/lib/wordpress/WpCliManager.ts` (NEW)
- `src/lib/wordpress/WordPressPluginManager.ts` (NEW)
- `src/types.ts` (add `WordPressPlugin` interface)
- `src/main-full.ts` (add IPC handlers)
- `src/security/schemas.ts` (add plugin schemas)
- `src/renderer.tsx` (add plugin UI section)
- `tests/unit/WpCliManager.test.ts` (NEW)
- `tests/integration/plugin-installation.test.ts` (NEW)

---

### Phase 1 Integration Checkpoint

**Date**: End of Week 2
**Duration**: 1 day

**Tasks**:
- [ ] Merge all three work streams into single branch
- [ ] Resolve any merge conflicts
- [ ] Run full test suite
- [ ] Manual integration testing:
  - Add Node.js app with WP env injection
  - Add Node.js app from monorepo subdirectory
  - Install WordPress plugin from Git
  - Test all three features together
- [ ] Performance testing: Ensure no regressions
- [ ] Security audit: Review all new code
- [ ] Update CHANGELOG.md
- [ ] Create v2.1.0-beta.1 tag

**Deliverable**: v2.1.0-beta.1 with all three distinguishing features

---

## 🎨 Phase 2: Developer Experience (Week 3-4)

**Goal**: Improve usability and polish existing features

**Team Size**: 3 developers working in parallel

### Work Stream 2.1: Package.json Script Detection

**Owner**: Developer UX Specialist
**Duration**: 2-3 days
**Risk**: LOW (isolated feature)

#### Tasks:
1. **Day 1: Parser Implementation**
   - [ ] Create `src/lib/PackageJsonParser.ts`:
     ```typescript
     interface DetectedScripts {
       install?: string;   // "npm install" or "yarn"
       build?: string[];   // ["npm run build", "yarn build"]
       start?: string[];   // ["npm start", "npm run dev"]
       dev?: string[];     // ["npm run dev", "yarn dev"]
     }
     ```
   - [ ] Implement `parsePackageJson(appPath): Promise<DetectedScripts>`
   - [ ] Handle errors gracefully (missing package.json)
   - [ ] Write unit tests

2. **Day 2: Integration**
   - [ ] Modify `NodeAppManager.addApp()`:
     - After Git clone, call `PackageJsonParser.parsePackageJson()`
     - Store detected scripts in app config
   - [ ] Modify IPC handler to return detected scripts
   - [ ] Update UI: Show dropdowns for install/build/start commands
   - [ ] Allow manual override (custom command input)

3. **Day 3: Polish & Testing**
   - [ ] Add smart defaults:
     - If `dev` script exists, suggest it for start command
     - If no build script, leave build command empty
   - [ ] Add tooltips explaining each script type
   - [ ] Integration tests: Parse real package.json files
   - [ ] Manual testing with various project types (Next.js, Express, etc.)

#### Success Criteria:
- [ ] Scripts auto-detected after Git clone
- [ ] UI shows helpful suggestions
- [ ] Manual override still works
- [ ] Tests achieve 80%+ coverage

---

### Work Stream 2.2: Better Error Messages & Validation

**Owner**: UX & Validation Specialist
**Duration**: 3-4 days
**Risk**: LOW (improves existing code)

#### Tasks:
1. **Day 1: Error Message Audit**
   - [ ] Review all error messages in codebase
   - [ ] Create error message style guide:
     - Start with what went wrong
     - Explain why it might have happened
     - Suggest how to fix it
   - [ ] List top 10 confusing error messages

2. **Day 2: Error Message Improvements**
   - [ ] Rewrite error messages to be user-friendly:
     ```typescript
     // Before
     throw new Error('Git clone failed');

     // After
     throw new Error(
       'Failed to clone repository. Please check:\n' +
       '- URL is correct and accessible\n' +
       '- Network connection is stable\n' +
       '- Git credentials are configured (for private repos)'
     );
     ```
   - [ ] Add error codes for easier debugging
   - [ ] Enhance `logAndSanitizeError()` to include suggestions

3. **Day 3: Real-time Validation**
   - [ ] Add inline validation to UI fields:
     - Git URL: Show checkmark when valid, error icon when invalid
     - Port: Check availability before save
     - Commands: Validate syntax as user types
   - [ ] Add validation feedback component:
     ```tsx
     <ValidationFeedback
       status="error"
       message="Git URL must start with https://, git@, or ssh://"
     />
     ```

4. **Day 4: Testing & Documentation**
   - [ ] Test error messages with real users (if possible)
   - [ ] Document common errors in TROUBLESHOOTING.md
   - [ ] Add FAQ section to README
   - [ ] Update inline help tooltips

#### Success Criteria:
- [ ] Error messages are clear and actionable
- [ ] Real-time validation prevents invalid inputs
- [ ] User testing shows reduced confusion
- [ ] TROUBLESHOOTING.md is comprehensive

---

### Work Stream 2.3: Real-time Log Streaming

**Owner**: Real-time Systems Specialist
**Duration**: 4-5 days
**Risk**: MEDIUM (performance considerations)

#### Tasks:
1. **Day 1: Design & Prototyping**
   - [ ] Research `fs.watch()` vs `tail -f` approach
   - [ ] Design streaming architecture:
     - Main process: Watch log file, emit events
     - Renderer: Subscribe to log events, update UI
   - [ ] Prototype: Simple log streaming POC
   - [ ] Performance test: Handle 1000s of log lines

2. **Day 2: LogStreamer Implementation**
   - [ ] Create `src/lib/LogStreamer.ts`:
     ```typescript
     class LogStreamer extends EventEmitter {
       startStreaming(logPath: string): void;
       stopStreaming(): void;
       getRecentLogs(lines: number): string[];
     }
     ```
   - [ ] Use `fs.watch()` or `tail` for file watching
   - [ ] Emit events when new lines are written
   - [ ] Handle file rotation, truncation

3. **Day 3: IPC Integration**
   - [ ] Add IPC channel: `node-orchestrator:stream-logs-start`
   - [ ] Add IPC channel: `node-orchestrator:stream-logs-stop`
   - [ ] Use `ipcRenderer.on()` for streaming events
   - [ ] Handle multiple simultaneous streams (multiple apps)
   - [ ] Add backpressure handling to prevent overwhelming renderer

4. **Day 4: UI Implementation**
   - [ ] Create log viewer component:
     - Auto-scroll toggle
     - Clear logs button
     - Filter by stdout/stderr
     - Search logs
     - Copy logs to clipboard
   - [ ] Use virtualized list for performance (react-window?)
   - [ ] Style with syntax highlighting for errors

5. **Day 5: Testing & Optimization**
   - [ ] Performance testing:
     - 100 lines/second
     - 1000 lines/second
     - 10,000 lines total
   - [ ] Memory leak testing
   - [ ] UI responsiveness testing
   - [ ] Add throttling/debouncing if needed

#### Success Criteria:
- [ ] Logs stream in real-time (< 100ms latency)
- [ ] UI remains responsive under load
- [ ] No memory leaks
- [ ] Tests achieve 70%+ coverage

---

### Phase 2 Integration Checkpoint

**Date**: End of Week 4
**Duration**: 1 day

**Tasks**:
- [ ] Merge all work streams
- [ ] Full test suite
- [ ] Manual testing of new features
- [ ] Performance regression testing
- [ ] Update documentation
- [ ] Create v2.2.0-beta.1 tag

**Deliverable**: v2.2.0-beta.1 with improved DX

---

## ✅ Phase 3: Quality & Infrastructure (Week 5-6)

**Goal**: Production-grade quality, comprehensive testing

**Team Size**: 3 developers working in parallel

### Work Stream 3.1: Comprehensive Test Suite

**Owner**: Test Engineer
**Duration**: 5-6 days
**Risk**: LOW (improves quality)

#### Tasks:
1. **Day 1: Test Infrastructure Setup**
   - [ ] Set up Jest with proper configuration
   - [ ] Add test coverage reporting (Istanbul/nyc)
   - [ ] Configure CI pipeline (GitHub Actions):
     ```yaml
     - Run tests on every PR
     - Check coverage threshold (80%)
     - Fail if coverage drops
     ```
   - [ ] Set up test fixtures (mock Local sites, Git repos)

2. **Day 2-3: Unit Tests**
   - [ ] Write unit tests for all manager classes:
     - `GitManager.test.ts` (85%+ coverage)
     - `NodeAppManager.test.ts` (85%+ coverage)
     - `ConfigManager.test.ts` (90%+ coverage)
     - `PortManager.test.ts` (90%+ coverage)
     - `NpmManager.test.ts` (85%+ coverage)
     - `WordPressEnvManager.test.ts` (90%+ coverage)
     - `WordPressPluginManager.test.ts` (80%+ coverage)
     - `WpCliManager.test.ts` (85%+ coverage)
   - [ ] Write tests for utility functions:
     - Validation functions
     - Error sanitization
     - Path helpers

3. **Day 4: Integration Tests**
   - [ ] Test IPC handlers with mock data:
     - Add app flow
     - Start/stop flow
     - Plugin installation flow
   - [ ] Test file operations:
     - Git cloning
     - Config persistence
     - Log reading

4. **Day 5: E2E Tests**
   - [ ] Full workflow tests:
     - Add app → Install → Build → Start → View logs → Stop → Remove
     - Install plugin → Activate → Deactivate → Remove
     - Add monorepo app → Start → Test WP env vars
   - [ ] Error scenario tests:
     - Invalid Git URL
     - Network failure during clone
     - npm install failure
     - Port conflict

5. **Day 6: Coverage & Documentation**
   - [ ] Achieve 80%+ overall coverage
   - [ ] Document test patterns in DEVELOPMENT_GUIDELINES.md
   - [ ] Add test README with setup instructions
   - [ ] Fix any flaky tests

#### Success Criteria:
- [ ] 80%+ code coverage
- [ ] All critical paths tested
- [ ] Tests run in CI
- [ ] No flaky tests
- [ ] Test documentation complete

---

### Work Stream 3.2: TypeScript Strict Mode

**Owner**: TypeScript Specialist
**Duration**: 3-4 days
**Risk**: LOW (improves code quality)

#### Tasks:
1. **Day 1: Enable Strict Mode**
   - [ ] Enable `"strict": true` in tsconfig.json
   - [ ] Enable additional checks:
     - `"noImplicitAny": true`
     - `"strictNullChecks": true`
     - `"strictFunctionTypes": true`
     - `"strictPropertyInitialization": true`
     - `"noImplicitReturns": true`
     - `"noFallthroughCasesInSwitch": true`
   - [ ] Compile and document all errors

2. **Day 2-3: Fix Type Errors**
   - [ ] Fix `any` types (replace with proper types)
   - [ ] Add null checks where needed
   - [ ] Fix function signatures
   - [ ] Add return types to all functions
   - [ ] Fix property initialization issues

3. **Day 4: Polish & Verification**
   - [ ] Remove all `@ts-ignore` comments
   - [ ] Add type guards where needed
   - [ ] Run full test suite
   - [ ] Verify no type errors remain
   - [ ] Update DEVELOPMENT_GUIDELINES.md

#### Success Criteria:
- [ ] `tsc` passes with strict mode
- [ ] Zero `any` types
- [ ] All functions have return types
- [ ] No `@ts-ignore` comments

---

### Work Stream 3.3: Security Audit & Hardening

**Owner**: Security Specialist
**Duration**: 4-5 days
**Risk**: MEDIUM (critical for production)

#### Tasks:
1. **Day 1: Security Review**
   - [ ] Review all IPC handlers for validation gaps
   - [ ] Audit all `spawn()` calls for command injection risks
   - [ ] Review file path handling for traversal vulnerabilities
   - [ ] Check for credential leakage in logs
   - [ ] Review error messages for information disclosure
   - [ ] Run `npm audit` and fix vulnerabilities

2. **Day 2: Penetration Testing**
   - [ ] Attempt command injection:
     - Try to inject commands via Git URL
     - Try to inject commands via subdirectory path
     - Try to inject commands via environment variables
   - [ ] Attempt path traversal:
     - Try `../../etc/passwd` in subdirectory field
     - Try absolute paths
     - Try symlink attacks
   - [ ] Test input validation:
     - Send malformed data to IPC handlers
     - Test boundary conditions (max lengths, etc.)
   - [ ] Document all attack vectors tested

3. **Day 3: Hardening**
   - [ ] Add rate limiting to prevent DoS:
     ```typescript
     const rateLimiter = new Map<string, number>();
     // Limit to 10 requests per minute per site
     ```
   - [ ] Add input sanitization for Git URLs
   - [ ] Add content security policy for renderer
   - [ ] Review and harden spawn() calls
   - [ ] Add security headers where applicable

4. **Day 4: Documentation**
   - [ ] Create SECURITY.md:
     - Threat model
     - Security architecture diagram
     - Attack surface analysis
     - Mitigation strategies
   - [ ] Document security best practices
   - [ ] Create incident response plan
   - [ ] Document vulnerability disclosure process

5. **Day 5: Final Verification**
   - [ ] Re-run penetration tests
   - [ ] Run automated security scanning tools
   - [ ] Code review with security focus
   - [ ] Sign-off on security posture

#### Success Criteria:
- [ ] Zero high/critical vulnerabilities
- [ ] All attack vectors mitigated
- [ ] Security documentation complete
- [ ] Pen test passed
- [ ] `npm audit` shows no high/critical issues

---

### Phase 3 Integration Checkpoint

**Date**: End of Week 6
**Duration**: 1 day

**Tasks**:
- [ ] Merge all work streams
- [ ] Full test suite (should achieve 80%+ coverage)
- [ ] Security verification
- [ ] Performance benchmarking
- [ ] Update all documentation
- [ ] Create v2.3.0-rc.1 tag

**Deliverable**: v2.3.0-rc.1 with production-grade quality

---

## 🎨 Phase 4: Modern UI & Polish (Week 7-8)

**Goal**: Modern React UI, documentation, final polish

**Team Size**: 3 developers working in parallel

### Work Stream 4.1: Modern React UI Refactor

**Owner**: Frontend Specialist
**Duration**: 5-6 days
**Risk**: MEDIUM (potential regressions)

#### Tasks:
1. **Day 1: Investigation & Planning**
   - [ ] Research why hooks were avoided originally
   - [ ] Test if React hooks work in Local addon context
   - [ ] Create POC: Simple component with hooks
   - [ ] If hooks work, proceed with refactor
   - [ ] If hooks fail, document why and skip this work stream

2. **Day 2-3: Component Refactoring**
   - [ ] Convert to JSX (update tsconfig.json, build)
   - [ ] Refactor main components to functional components:
     - `AddAppModal.tsx`
     - `AppCard.tsx`
     - `AppLogs.tsx`
     - `NodeAppsTab.tsx`
   - [ ] Use hooks appropriately:
     - `useState` for local state
     - `useEffect` for side effects
     - `useCallback` for memoization
     - `useMemo` for expensive computations

3. **Day 4: Component Extraction**
   - [ ] Extract reusable components:
     - `Button` component
     - `Input` component
     - `Select` component
     - `ValidationFeedback` component
     - `LoadingSpinner` component
   - [ ] Add TypeScript types for all props
   - [ ] Use CSS modules or styled-components

4. **Day 5: Testing & Verification**
   - [ ] Update component tests
   - [ ] Visual regression testing
   - [ ] Test all user flows
   - [ ] Ensure no crashes or errors
   - [ ] Performance comparison (before/after)

5. **Day 6: Polish**
   - [ ] Improve styling and UX
   - [ ] Add animations/transitions
   - [ ] Improve accessibility (ARIA labels, keyboard nav)
   - [ ] Dark mode support (if Local supports it)

#### Success Criteria:
- [ ] Modern React code with hooks and JSX
- [ ] No regressions in functionality
- [ ] Improved code maintainability
- [ ] Tests updated and passing
- [ ] Performance is same or better

#### Fallback Plan:
If hooks don't work in Local addon context:
- [ ] Still convert to JSX
- [ ] Keep class components
- [ ] Extract reusable components
- [ ] Improve styling and UX

---

### Work Stream 4.2: User Documentation

**Owner**: Technical Writer
**Duration**: 4-5 days
**Risk**: LOW

#### Tasks:
1. **Day 1: User Guide**
   - [ ] Create `docs/USER_GUIDE.md`:
     - Getting started
     - Adding Node.js apps
     - Using WordPress environment variables
     - Installing WordPress plugins
     - Working with monorepos
     - Managing environment variables
     - Viewing logs
     - Common workflows

2. **Day 2: Troubleshooting Guide**
   - [ ] Create `docs/TROUBLESHOOTING.md`:
     - Common errors and solutions
     - Debug logging
     - Support contact info
     - FAQ section
   - [ ] Include screenshots/GIFs for clarity

3. **Day 3: Examples**
   - [ ] Create `docs/EXAMPLES.md`:
     - Express.js API connected to WordPress
     - Next.js frontend with WordPress backend
     - Monorepo with multiple apps
     - WordPress plugin development workflow
     - Using environment variables
   - [ ] Create example repos on GitHub (if allowed)

4. **Day 4: README Update**
   - [ ] Update main README.md:
     - Feature list (highlight distinguishing features)
     - Installation instructions
     - Quick start guide
     - Links to detailed docs
     - Screenshots/demo video
     - Contributing guide
   - [ ] Add badges (version, tests, coverage)

5. **Day 5: Video & Polish**
   - [ ] Create demo video (5-10 minutes):
     - Show main features
     - Walk through common workflow
     - Highlight distinguishing features
   - [ ] Proofread all documentation
   - [ ] Ensure consistent formatting
   - [ ] Update CHANGELOG.md

#### Success Criteria:
- [ ] Complete user documentation
- [ ] All features documented
- [ ] Examples are working and tested
- [ ] Demo video created
- [ ] README is compelling and clear

---

### Work Stream 4.3: Code Documentation & Cleanup

**Owner**: Code Quality Specialist
**Duration**: 3-4 days
**Risk**: LOW

#### Tasks:
1. **Day 1: JSDoc Comments**
   - [ ] Add JSDoc to all public methods:
     ```typescript
     /**
      * Adds a new Node.js app to a WordPress site
      *
      * @param site - The Local site object
      * @param appConfig - Configuration for the app
      * @param onProgress - Optional progress callback
      * @returns The created app object
      * @throws {Error} If Git clone or npm install fails
      *
      * @example
      * const app = await manager.addApp(site, {
      *   name: 'my-api',
      *   gitUrl: 'https://github.com/user/repo.git',
      *   branch: 'main'
      * });
      */
     ```
   - [ ] Add examples to complex methods
   - [ ] Document parameters, return values, errors

2. **Day 2: Inline Comments**
   - [ ] Add comments explaining complex logic
   - [ ] Document "why" not "what"
   - [ ] Remove obvious comments
   - [ ] Remove commented-out code (git history exists!)

3. **Day 3: Code Cleanup**
   - [ ] Remove unused imports
   - [ ] Remove dead code
   - [ ] Standardize code formatting (Prettier)
   - [ ] Organize imports (sort alphabetically)
   - [ ] Fix ESLint warnings

4. **Day 4: Architecture Documentation**
   - [ ] Update CONTEXT.md with latest changes
   - [ ] Create architecture diagram (tools/visualization)
   - [ ] Document data flow
   - [ ] Document IPC communication patterns
   - [ ] Update DEVELOPMENT_GUIDELINES.md

#### Success Criteria:
- [ ] All public APIs documented
- [ ] No dead code or commented code
- [ ] Consistent formatting
- [ ] Architecture docs updated
- [ ] ESLint passes with zero warnings

---

### Phase 4 Final Integration

**Date**: End of Week 8
**Duration**: 2 days

**Tasks**:
- [ ] Merge all work streams
- [ ] Full test suite (final verification)
- [ ] Security audit (final verification)
- [ ] Performance benchmarking (final)
- [ ] Manual testing of all features
- [ ] User acceptance testing (if possible)
- [ ] Final documentation review
- [ ] Create v3.0.0-rc.1 tag
- [ ] Prepare release notes
- [ ] Create GitHub release draft

**Deliverable**: v3.0.0-rc.1 ready for release

---

## 🚀 Release Process (Week 9)

**Duration**: 3-4 days

### Day 1: Release Candidate Testing
- [ ] Deploy v3.0.0-rc.1 to test environment
- [ ] Manual testing of all features
- [ ] User acceptance testing
- [ ] Gather feedback
- [ ] Fix critical bugs (if any)

### Day 2: Release Preparation
- [ ] Finalize CHANGELOG.md
- [ ] Update version numbers
- [ ] Create release notes
- [ ] Prepare marketing materials (blog post, social media)
- [ ] Update screenshots/demo video

### Day 3: Release
- [ ] Create v3.0.0 tag
- [ ] Merge to `main` branch
- [ ] Create GitHub release
- [ ] Publish to npm (if applicable)
- [ ] Update documentation site
- [ ] Announce release (blog, Twitter, etc.)

### Day 4: Post-Release
- [ ] Monitor for issues
- [ ] Respond to user feedback
- [ ] Plan hotfixes if needed
- [ ] Start planning v3.1.0

---

## 📊 Resource Allocation

### Team Composition (Recommended)

**3 Full-time Developers**:
- **Developer A**: Backend/Integration focus
  - Phase 1: WP Env Injection (1.1)
  - Phase 2: Script Detection (2.1)
  - Phase 3: Test Suite (3.1)
  - Phase 4: Code Cleanup (4.3)

- **Developer B**: Git/Security focus
  - Phase 1: Monorepo Support (1.2)
  - Phase 2: Better Errors (2.2)
  - Phase 3: Security Audit (3.3)
  - Phase 4: User Docs (4.2)

- **Developer C**: WordPress/Frontend focus
  - Phase 1: WP Plugin Management (1.3) *starts after 1.2*
  - Phase 2: Log Streaming (2.3)
  - Phase 3: TypeScript Strict (3.2)
  - Phase 4: React Refactor (4.1)

**Note**: Developer C has lighter load in Phase 1 week 1 (waiting for 1.2), can assist with code reviews and testing.

### Weekly Time Breakdown

| Phase | Week | Dev A | Dev B | Dev C | Total |
|-------|------|-------|-------|-------|-------|
| 1 | 1 | 1.1 (4d) | 1.2 (4d) | Review | 8 dev-days |
| 1 | 2 | 1.1 (cont) | 1.2 (cont) | 1.3 (5d) | 15 dev-days |
| 2 | 3 | 2.1 (3d) | 2.2 (4d) | 2.3 (5d) | 12 dev-days |
| 2 | 4 | 2.1 (cont) | 2.2 (cont) | 2.3 (cont) | 12 dev-days |
| 3 | 5 | 3.1 (6d) | 3.3 (5d) | 3.2 (4d) | 15 dev-days |
| 3 | 6 | 3.1 (cont) | 3.3 (cont) | 3.2 (cont) | 15 dev-days |
| 4 | 7 | 4.3 (4d) | 4.2 (5d) | 4.1 (6d) | 15 dev-days |
| 4 | 8 | 4.3 (cont) | 4.2 (cont) | 4.1 (cont) | 15 dev-days |
| Release | 9 | All hands on deck | | | 9 dev-days |

**Total**: ~116 developer-days over 9 weeks

---

## 🎯 Success Metrics

### Phase 1 (WordPress Integration)
- ✅ All three distinguishing features working
- ✅ Zero high/critical security vulnerabilities
- ✅ 70%+ test coverage for new code
- ✅ Manual testing successful
- ✅ Performance: App start time < 5 seconds

### Phase 2 (Developer Experience)
- ✅ User testing shows improved satisfaction
- ✅ Error messages are clear and actionable
- ✅ Logs stream in real-time (< 100ms latency)
- ✅ 75%+ test coverage overall
- ✅ No performance regressions

### Phase 3 (Quality)
- ✅ 80%+ code coverage
- ✅ Zero high/critical vulnerabilities
- ✅ TypeScript strict mode enabled
- ✅ All tests passing in CI
- ✅ Security pen test passed

### Phase 4 (Polish)
- ✅ Modern React UI (if possible)
- ✅ Complete user documentation
- ✅ Demo video created
- ✅ All public APIs documented
- ✅ ESLint passes with zero warnings

### Release (v3.0.0)
- ✅ All features working as expected
- ✅ No known critical bugs
- ✅ Documentation complete
- ✅ User acceptance testing passed
- ✅ Release notes prepared

---

## 🚨 Risk Mitigation

### High-Risk Items

1. **WordPress Environment Variables Extraction**
   - **Risk**: Local's site object structure might not expose all needed data
   - **Mitigation**:
     - Research thoroughly before starting (Day 1)
     - Check Kitchen Sink addon for examples
     - Have fallback: Manual env var configuration
     - Early testing with real Local sites

2. **WP-CLI Path Resolution**
   - **Risk**: WP-CLI path might change between Local versions
   - **Mitigation**:
     - Don't hardcode path
     - Implement dynamic detection
     - Test with multiple Local versions
     - Document required Local version

3. **React Hooks in Local Addon**
   - **Risk**: Hooks might not work in Local's Electron environment
   - **Mitigation**:
     - Test early (Phase 4, Day 1)
     - Have fallback: Keep class components, convert to JSX
     - Don't block release on this feature

4. **Monorepo Path Traversal**
   - **Risk**: Path validation bypass could lead to security vulnerability
   - **Mitigation**:
     - Multi-layer validation (Zod, filesystem, resolved paths)
     - Comprehensive security testing
     - Code review by security specialist
     - Penetration testing in Phase 3

### Medium-Risk Items

1. **Log Streaming Performance**
   - **Risk**: UI might freeze with high-volume logs
   - **Mitigation**:
     - Performance testing early
     - Add throttling/debouncing
     - Use virtualized list
     - Add backpressure handling

2. **Test Coverage Threshold**
   - **Risk**: Might not reach 80% coverage
   - **Mitigation**:
     - Write tests alongside features (not after)
     - Set minimum 70% per PR
     - Allocate dedicated time in Phase 3
     - Use coverage tools to identify gaps

### Low-Risk Items

1. **Script Detection**
   - Easy to implement, isolated feature
   - Clear requirements, low complexity

2. **Better Error Messages**
   - Improves existing code, low risk
   - Can be done incrementally

---

## 📅 Timeline Summary

| Phase | Duration | Deliverable | Key Features |
|-------|----------|-------------|--------------|
| 1 | 2 weeks | v2.1.0-beta.1 | WP env vars, monorepo, WP plugins |
| 2 | 2 weeks | v2.2.0-beta.1 | Script detection, better errors, log streaming |
| 3 | 2 weeks | v2.3.0-rc.1 | Tests, strict mode, security audit |
| 4 | 2 weeks | v3.0.0-rc.1 | Modern UI, documentation, polish |
| Release | 1 week | v3.0.0 | Production release |

**Total**: 9 weeks from start to release

---

## 🔄 Daily Standup Format

**Time**: 15 minutes daily
**Format**:
- What did you complete yesterday?
- What are you working on today?
- Any blockers or questions?
- Any integration concerns?

**Important**: Flag integration issues early!

---

## 🔗 Integration Strategy

### Branch Strategy
```
sculptor/add-wp-env-auto-injection (current)
├── phase-1-wp-integration (created in Week 1)
│   ├── feature/wp-env-injection
│   ├── feature/monorepo-support
│   └── feature/wp-plugin-mgmt
├── phase-2-dx (created in Week 3)
│   ├── feature/script-detection
│   ├── feature/better-errors
│   └── feature/log-streaming
├── phase-3-quality (created in Week 5)
│   ├── feature/test-suite
│   ├── feature/typescript-strict
│   └── feature/security-audit
└── phase-4-polish (created in Week 7)
    ├── feature/react-refactor
    ├── feature/user-docs
    └── feature/code-cleanup
```

### Integration Points
1. **Daily**: Pull latest changes from phase branch
2. **Mid-week**: Quick sync to identify conflicts
3. **End of phase**: Full integration checkpoint (1 day)
4. **Before release**: Final integration (2 days)

---

## 🎓 Knowledge Transfer

### Documentation Requirements
- All new code must have JSDoc comments
- Complex logic must have inline comments
- Update CONTEXT.md when architecture changes
- Update ROADMAP.md when priorities change
- Update DEVELOPMENT_GUIDELINES.md when patterns change

### Code Review Checklist
- [ ] Tests written and passing
- [ ] Security validated (Zod schemas, command validation)
- [ ] Error handling implemented
- [ ] Logging added for important operations
- [ ] Documentation updated
- [ ] No regressions in existing features
- [ ] Performance acceptable

---

## 🎉 Definition of Done

### Feature-level
- [ ] Implementation complete
- [ ] Tests written (70%+ coverage)
- [ ] Manual testing passed
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No high/critical bugs

### Phase-level
- [ ] All features complete
- [ ] Integration testing passed
- [ ] Performance testing passed
- [ ] Security review passed
- [ ] Documentation complete
- [ ] Tag created

### Release-level
- [ ] All phases complete
- [ ] 80%+ code coverage
- [ ] Zero high/critical vulnerabilities
- [ ] User acceptance testing passed
- [ ] Documentation complete
- [ ] Demo video created
- [ ] Release notes prepared
- [ ] GitHub release published

---

## 🚀 Getting Started

### Week 1, Day 1 Checklist

**All Developers**:
- [ ] Read CONTEXT.md, ROADMAP.md, DEVELOPMENT_GUIDELINES.md
- [ ] Set up development environment
- [ ] Build and run addon in Local
- [ ] Manual testing of existing features
- [ ] Review code structure

**Developer A**:
- [ ] Start Work Stream 1.1 (WP Env Injection)
- [ ] Research Local's site object structure

**Developer B**:
- [ ] Start Work Stream 1.2 (Monorepo Support)
- [ ] Design path validation strategy

**Developer C**:
- [ ] Study WP-CLI in Local
- [ ] Review Kitchen Sink addon for WP integration examples
- [ ] Prepare for Work Stream 1.3 (starts Week 1, Day 3)

---

## 📞 Communication

### Async Communication (Preferred)
- Document decisions in GitHub issues/PRs
- Use PR descriptions to explain approach
- Comment on code for clarification
- Update CONTEXT.md for architecture changes

### Sync Communication (When Needed)
- Daily standup (15 min)
- Integration planning sessions
- Blocker resolution
- Architecture decisions

---

## 🎯 Next Steps

1. **Review this plan** with team
2. **Adjust timeline** if needed based on team size
3. **Create Phase 1 branch** from current branch
4. **Create feature branches** for work streams 1.1, 1.2
5. **Start Day 1** of Phase 1
6. **Begin daily standups**

---

**Current Branch**: `sculptor/add-wp-env-auto-injection`
**Target Branch for Phase PRs**: `sculptor/add-wp-env-auto-injection`
**Eventually merge to**: `review-and-improve`
**Production Branch**: `main`

**Current Version**: v2.0.0
**Next Version**: v2.1.0-beta.1 (end of Phase 1)
**Target Version**: v3.0.0 (end of Phase 4)

**Estimated Timeline**: 9 weeks (8 weeks development + 1 week release)
**Last Updated**: November 22, 2025

---

## 📝 Appendix: Alternative Approaches Considered

### Why Not 9 Parallel Agents?
- **Risk**: Too many merge conflicts
- **Risk**: Difficult to coordinate
- **Risk**: Integration becomes a bottleneck
- **Better**: 3-4 developers, well-coordinated

### Why Not Defer Testing to End?
- **Risk**: Technical debt accumulates
- **Risk**: Hard to fix bugs in old code
- **Risk**: Coverage never reaches target
- **Better**: Test as you go, minimum coverage per PR

### Why Not Do All DX Improvements First?
- **Risk**: Delays distinguishing features
- **Risk**: Lower ROI initially
- **Better**: Get core differentiators working first, polish later

### Why Not Skip React Refactor?
- **Consider**: Original plan avoided hooks due to crashes
- **Decision**: Test early, have fallback (JSX only)
- **Rationale**: If hooks work, big maintainability win; if not, JSX still an improvement
