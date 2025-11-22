# Node.js Orchestrator - Parallel Development Roadmap

## 🎯 Vision & Distinguishing Features

Enable Local users to seamlessly integrate Node.js applications with WordPress sites, making full-stack development effortless. Our **three key distinguishing features** set us apart:

1. **WordPress Environment Auto-Injection**: Automatically inject WordPress database credentials, site URLs, and other environment variables into Node.js apps
2. **WordPress Plugin Management**: Install and activate WordPress plugins from Git repositories or monorepo subdirectories alongside Node.js apps
3. **Monorepo Support**: Support both Node.js apps and WordPress plugins located in subdirectories of Git repositories

## 📊 Current State (v2.0.0)

### ✅ Completed Features
- Git repository cloning with progress tracking
- npm/yarn/pnpm dependency installation
- **Hybrid npm support**: System npm first, bundled npm fallback (no Node.js installation required!)
- Build command support
- Process spawning and lifecycle management
- Port allocation (3000-3999 range)
- Config persistence (JSON files per site)
- UI with React class components
- Port management with clickable links
- Edit app configuration
- View logs (last 100 lines)
- Environment variables editor
- Auto-refresh UI every 2 seconds
- Proper cleanup on site deletion
- **4-layer security architecture**: Zod validation, command sanitization, path validation, error sanitization

### 📁 Current Architecture
```
src/
├── main-full.ts              # Main process entry (IPC handlers, hooks)
├── renderer.tsx              # UI components (React class components)
├── types.ts                  # TypeScript interfaces
├── lib/
│   ├── NodeAppManager.ts     # Core app lifecycle management
│   ├── GitManager.ts         # Git cloning with progress
│   ├── ConfigManager.ts      # JSON config persistence
│   ├── PortManager.ts        # Port allocation (3000-3999)
│   └── NpmManager.ts         # Hybrid npm support (system/bundled)
└── security/
    ├── schemas.ts            # Zod validation schemas
    ├── validation.ts         # Command validation
    └── errors.ts             # Error sanitization
```

## 🚀 Parallel Development Plan

This roadmap is optimized for **9 concurrent agents** working in parallel. Work streams are organized by priority and dependencies.

---

## Priority 1: WordPress Integration (Distinguishing Features)

### Work Stream A1: WordPress Environment Variables Auto-Injection ⭐

**Goal**: Automatically inject WordPress site configuration into Node.js apps' environment variables

**Agent**: Backend Integration Specialist
**Dependencies**: None (can start immediately)
**Estimated Effort**: Medium
**Files to Create/Modify**:
- `src/lib/WordPressEnvManager.ts` (NEW)
- `src/lib/NodeAppManager.ts` (modify startApp method)
- `src/types.ts` (add WP env interfaces)

**Tasks**:
1. Create `WordPressEnvManager` class to extract WordPress configuration
2. Parse Local's site object to get:
   - `WP_DB_HOST`: Database hostname
   - `WP_DB_NAME`: Database name
   - `WP_DB_USER`: Database username
   - `WP_DB_PASSWORD`: Database password
   - `WP_SITE_URL`: WordPress site URL (e.g., `http://mysite.local`)
   - `WP_HOME_URL`: WordPress home URL
   - `WP_ADMIN_URL`: WordPress admin URL
   - `WP_CONTENT_DIR`: Path to wp-content directory
   - `WP_UPLOADS_DIR`: Path to uploads directory
3. Integrate with `NodeAppManager.startApp()` to merge WP env vars with app env vars
4. Add UI toggle: "Inject WordPress Environment Variables" (default: true)
5. Add to `AppConfig` interface: `injectWpEnv: boolean`
6. Update IPC schemas to validate WP env injection flag

**Security Considerations**:
- Sanitize database credentials before logging
- Validate Local's site object structure
- Never expose credentials in UI or logs
- Use Zod schema for validation

**Testing**:
- Unit tests: Extract env vars from mock site object
- Integration test: Start app with WP env vars injected
- Security test: Verify credentials not logged

**Success Criteria**:
- Node.js apps can connect to WordPress database using injected env vars
- UI toggle works correctly
- No credentials leaked in logs
- Tests passing

---

### Work Stream A2: Monorepo Support with Subdirectories ⭐

**Goal**: Support cloning Git repos and using apps/plugins from subdirectories

**Agent**: Git & File System Specialist
**Dependencies**: None (can start immediately)
**Estimated Effort**: Medium
**Files to Create/Modify**:
- `src/lib/GitManager.ts` (modify cloneRepository)
- `src/lib/ConfigManager.ts` (add subdirectory support)
- `src/renderer.tsx` (add subdirectory input field)
- `src/types.ts` (add subdirectory field to NodeApp)
- `src/security/schemas.ts` (validate subdirectory paths)

**Tasks**:
1. Add `subdirectory` field to `NodeApp` interface (optional string)
2. Update `GitManager.cloneRepository()` to support subdirectory parameter
3. After cloning, verify subdirectory exists and contains package.json
4. Update `NodeAppManager` to use subdirectory as working directory:
   - Install dependencies in subdirectory
   - Build in subdirectory
   - Start app from subdirectory
5. Add UI field: "Subdirectory (optional)" with placeholder: "e.g., packages/api"
6. Update validation to prevent path traversal (e.g., no `../`)
7. Update config persistence to store subdirectory path

**Security Considerations**:
- Validate subdirectory path (no `../`, must be relative)
- Ensure subdirectory is within cloned repo
- Check subdirectory exists before operations
- Add to Zod schema validation

**Edge Cases**:
- Subdirectory doesn't exist
- Subdirectory doesn't have package.json
- Nested subdirectories (e.g., `apps/backend/api`)
- Monorepo with multiple package.json files

**Testing**:
- Test with monorepo containing multiple apps
- Test nested subdirectories
- Test path traversal attempts (should fail)
- Test non-existent subdirectories (should fail)

**Success Criteria**:
- Can clone repo and use app from subdirectory
- Path traversal attempts blocked
- UI shows subdirectory field
- Tests passing

---

### Work Stream A3: WordPress Plugin Installation & Activation ⭐

**Goal**: Support installing and activating WordPress plugins from Git repos or monorepo subdirectories

**Agent**: WordPress Integration Specialist
**Dependencies**: A2 (uses subdirectory support)
**Estimated Effort**: Large
**Files to Create/Modify**:
- `src/lib/WordPressPluginManager.ts` (NEW)
- `src/renderer.tsx` (add plugin configuration UI)
- `src/types.ts` (add WordPressPlugin interface)
- `src/main-full.ts` (add IPC handlers for plugin operations)
- `src/security/schemas.ts` (add plugin validation schemas)

**Tasks**:
1. Create `WordPressPluginManager` class:
   - `installPlugin(gitUrl, branch, subdirectory?)`: Clone plugin to wp-content/plugins
   - `activatePlugin(pluginSlug)`: Activate via WP-CLI
   - `deactivatePlugin(pluginSlug)`: Deactivate via WP-CLI
   - `removePlugin(pluginSlug)`: Delete plugin directory
2. Use WP-CLI for activation (available at: `/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp`)
3. Add `WordPressPlugin` interface:
   ```typescript
   interface WordPressPlugin {
     id: string;
     name: string;
     gitUrl: string;
     branch: string;
     subdirectory?: string;  // For monorepos
     status: 'installing' | 'installed' | 'active' | 'error';
     installedPath: string;
     createdAt: Date;
   }
   ```
4. Add IPC handlers:
   - `node-orchestrator:install-plugin`
   - `node-orchestrator:activate-plugin`
   - `node-orchestrator:deactivate-plugin`
   - `node-orchestrator:remove-plugin`
   - `node-orchestrator:get-plugins`
5. Add UI section: "WordPress Plugins" with list of installed plugins
6. Reuse Git cloning logic from `GitManager`
7. Store plugin configs in same JSON file as apps

**Security Considerations**:
- Validate WP-CLI path exists
- Sanitize plugin slugs (alphanumeric + dashes only)
- Validate Git URLs
- Verify plugin directory is within wp-content/plugins
- Use Zod schemas for all inputs

**Integration Points**:
- **A2**: Uses subdirectory support for monorepo plugins
- **A1**: Could inject WP env vars into plugin build process if needed

**Testing**:
- Test installing plugin from Git
- Test activating/deactivating via WP-CLI
- Test monorepo plugin (subdirectory)
- Test cleanup on site deletion

**Success Criteria**:
- Can install WordPress plugin from Git
- Can activate plugin via WP-CLI
- Plugins survive Local restart
- Monorepo plugins work correctly
- Tests passing

---

## Priority 2: Developer Experience Improvements

### Work Stream B1: Package.json Script Detection

**Goal**: Auto-detect and suggest npm scripts from package.json

**Agent**: Developer UX Specialist
**Dependencies**: None (can start immediately)
**Estimated Effort**: Small
**Files to Create/Modify**:
- `src/lib/PackageJsonParser.ts` (NEW)
- `src/renderer.tsx` (add script dropdown)

**Tasks**:
1. Create `PackageJsonParser.getScripts(appPath)` to read package.json scripts
2. After Git clone, parse package.json and extract scripts
3. Show dropdown in UI: "Detected Scripts" with options like:
   - `npm run dev`
   - `npm run start`
   - `npm run build`
   - Custom command (manual input)
4. Pre-populate start/build commands based on detected scripts

**Success Criteria**:
- Scripts auto-detected after clone
- Dropdown shows available scripts
- Manual override still possible

---

### Work Stream B2: Better Error Messages & Validation

**Goal**: Improve user-facing error messages and input validation

**Agent**: UX & Validation Specialist
**Dependencies**: None (can start immediately)
**Estimated Effort**: Small
**Files to Create/Modify**:
- `src/security/errors.ts` (enhance sanitization)
- `src/renderer.tsx` (add inline validation feedback)

**Tasks**:
1. Add real-time validation feedback in UI:
   - Git URL validation (show checkmark/error as user types)
   - Port availability check before save
   - Command syntax validation
2. Improve error messages:
   - "Git clone failed" → "Failed to clone repository. Check URL and network connection."
   - "npm install failed" → "Dependency installation failed. Check package.json and try again."
3. Add contextual help tooltips for each field
4. Show validation errors inline (not just in console)

**Success Criteria**:
- Users see helpful error messages
- Real-time validation prevents invalid inputs
- Reduced troubleshooting time

---

### Work Stream B3: Modern React UI Refactor

**Goal**: Modernize UI with React hooks and JSX

**Agent**: Frontend Specialist
**Dependencies**: None (can start immediately, but should coordinate with other UI changes)
**Estimated Effort**: Medium
**Files to Modify**:
- `src/renderer.tsx` (complete rewrite)

**Tasks**:
1. Convert from React.createElement to JSX
2. Convert class components to functional components with hooks
3. Use `useState`, `useEffect`, `useCallback` appropriately
4. Improve component structure:
   - Split into smaller components (AppCard, AppList, AddAppModal, etc.)
   - Extract reusable components
5. Add proper TypeScript types for all components
6. Use CSS modules or styled-components for styling

**Considerations**:
- Original codebase avoided hooks due to crashes - investigate if still an issue
- May need to update build config for JSX support
- Should coordinate with B4 (log streaming) for UI integration

**Success Criteria**:
- Modern React code with hooks
- JSX instead of createElement
- No crashes or regressions
- Improved code maintainability

---

### Work Stream B4: Real-time Log Streaming

**Goal**: Stream logs in real-time instead of polling

**Agent**: Real-time Systems Specialist
**Dependencies**: B3 (benefits from modern React UI)
**Estimated Effort**: Medium
**Files to Create/Modify**:
- `src/lib/LogStreamer.ts` (NEW)
- `src/main-full.ts` (add streaming IPC handler)
- `src/renderer.tsx` (add log streaming UI)

**Tasks**:
1. Create `LogStreamer` class using `fs.watch()` or `tail -f` pattern
2. Add IPC channel for streaming: `node-orchestrator:stream-logs`
3. Use event-based streaming instead of polling
4. Add UI controls:
   - Auto-scroll toggle
   - Clear logs button
   - Log level filter (stdout/stderr)
   - Search logs
5. Optimize for performance (buffer updates, virtualized scrolling)

**Success Criteria**:
- Logs stream in real-time
- No polling/refresh needed
- UI performance is good even with many logs

---

## Priority 3: Infrastructure & Quality

### Work Stream C1: Comprehensive Test Suite

**Goal**: Add unit, integration, and E2E tests

**Agent**: Test Engineer
**Dependencies**: None (can start immediately)
**Estimated Effort**: Large
**Files to Create**:
- `tests/unit/` (unit tests for all managers)
- `tests/integration/` (IPC handler tests)
- `tests/e2e/` (full workflow tests)

**Tasks**:
1. Unit tests for all manager classes:
   - `GitManager.test.ts`
   - `NodeAppManager.test.ts`
   - `ConfigManager.test.ts`
   - `PortManager.test.ts`
   - `NpmManager.test.ts`
   - `WordPressEnvManager.test.ts` (new)
   - `WordPressPluginManager.test.ts` (new)
2. Integration tests for IPC handlers
3. E2E tests:
   - Add app from Git → Install → Start → View logs → Stop → Remove
   - Install WordPress plugin → Activate → Deactivate → Remove
4. Set up CI pipeline (GitHub Actions)
5. Target code coverage: 80%+

**Success Criteria**:
- 80%+ code coverage
- All critical paths tested
- Tests run in CI
- No flaky tests

---

### Work Stream C2: TypeScript Strict Mode

**Goal**: Enable TypeScript strict mode and fix all errors

**Agent**: TypeScript Specialist
**Dependencies**: None (can start immediately)
**Estimated Effort**: Medium
**Files to Modify**: All TypeScript files

**Tasks**:
1. Enable `"strict": true` in tsconfig.json
2. Fix all type errors:
   - Add proper return types
   - Remove `any` types
   - Add null checks
   - Fix function signatures
3. Enable additional strict checks:
   - `"noImplicitAny": true`
   - `"strictNullChecks": true`
   - `"strictFunctionTypes": true`
   - `"strictPropertyInitialization": true`

**Success Criteria**:
- `tsc` passes with strict mode
- No `any` types
- Improved type safety

---

### Work Stream C3: Security Audit & Hardening

**Goal**: Comprehensive security review and hardening

**Agent**: Security Specialist
**Dependencies**: None (can start immediately, review existing code)
**Estimated Effort**: Medium
**Files to Review**: All files, especially IPC handlers and spawn calls

**Tasks**:
1. Review all IPC handlers for validation gaps
2. Audit all `spawn()` calls for command injection risks
3. Review file path handling for traversal vulnerabilities
4. Check for credential leakage in logs
5. Add rate limiting to prevent DoS
6. Review dependencies for known vulnerabilities (`npm audit`)
7. Add security documentation:
   - Threat model
   - Security architecture diagram
   - Incident response plan
8. Penetration testing:
   - Attempt command injection
   - Attempt path traversal
   - Attempt XSS in UI

**Success Criteria**:
- Zero high/critical vulnerabilities
- All attack vectors mitigated
- Security documentation complete
- Pen test passed

---

## Priority 4: Documentation & Polish

### Work Stream D1: User Documentation

**Goal**: Create comprehensive user guide

**Agent**: Technical Writer
**Dependencies**: All features complete
**Estimated Effort**: Medium
**Files to Create**:
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/EXAMPLES.md`

**Tasks**:
1. User guide:
   - Getting started
   - Adding Node.js apps
   - Adding WordPress plugins
   - Environment variables
   - Monorepo setup
   - Common workflows
2. Troubleshooting guide:
   - Common errors and solutions
   - Debug logging
   - Support contact info
3. Examples:
   - Express.js API with WordPress
   - Next.js frontend with WordPress backend
   - Monorepo with multiple apps
   - WP plugin development workflow

**Success Criteria**:
- Users can follow docs without support
- All features documented
- Examples are working

---

### Work Stream D2: Code Documentation & Cleanup

**Goal**: Improve code comments and remove dead code

**Agent**: Code Quality Specialist
**Dependencies**: All features complete
**Estimated Effort**: Small
**Files to Review**: All source files

**Tasks**:
1. Add JSDoc comments to all public methods
2. Add inline comments for complex logic
3. Remove dead code and commented-out code
4. Remove unused imports
5. Standardize code formatting (Prettier)
6. Update README.md with latest features

**Success Criteria**:
- All public APIs documented
- No dead code
- Consistent formatting
- README is up-to-date

---

## 📈 Phased Development Strategy

### Phase 1: WordPress Integration (Weeks 1-3)
**Parallel Work Streams**: A1, A2 (2 agents)
- Week 1: A1 (WP Env Injection) + A2 (Monorepo Support)
- Week 2: A3 (WP Plugin Management) depends on A2
- Week 3: Integration testing, bug fixes

**Deliverable**: v2.1.0 with all three distinguishing features

### Phase 2: Developer Experience (Weeks 4-6)
**Parallel Work Streams**: B1, B2, B3, B4 (4 agents)
- Week 4-5: All B streams in parallel
- Week 6: Integration, testing, bug fixes

**Deliverable**: v2.2.0 with improved DX

### Phase 3: Quality & Infrastructure (Weeks 7-9)
**Parallel Work Streams**: C1, C2, C3 (3 agents)
- Week 7-8: All C streams in parallel
- Week 9: Review, fix, verify

**Deliverable**: v2.3.0 with production-grade quality

### Phase 4: Documentation & Polish (Weeks 10-11)
**Parallel Work Streams**: D1, D2 (2 agents)
- Week 10-11: Documentation and cleanup

**Deliverable**: v3.0.0 ready for public release

---

## 🔗 Dependency Graph

```
Legend: → depends on, || parallel with

Phase 1 (WordPress Integration):
A1 (WP Env Injection)    || A2 (Monorepo Support)
                            ↓
                         A3 (WP Plugin Mgmt)

Phase 2 (Developer Experience):
B1 (Script Detection) || B2 (Better Errors) || B3 (React Refactor)
                                                      ↓
                                                   B4 (Log Streaming)

Phase 3 (Quality):
C1 (Tests) || C2 (TypeScript Strict) || C3 (Security Audit)

Phase 4 (Documentation):
D1 (User Docs) || D2 (Code Docs)
```

---

## 👥 Agent Assignments

**Total Agents**: 9 concurrent agents

### Phase 1 Agents
1. **Backend Integration Specialist** → A1 (WP Env Injection)
2. **Git & File System Specialist** → A2 (Monorepo Support)
3. **WordPress Integration Specialist** → A3 (WP Plugin Management)

### Phase 2 Agents
4. **Developer UX Specialist** → B1 (Script Detection)
5. **UX & Validation Specialist** → B2 (Better Errors)
6. **Frontend Specialist** → B3 (React Refactor)
7. **Real-time Systems Specialist** → B4 (Log Streaming)

### Phase 3 Agents
8. **Test Engineer** → C1 (Tests)
9. **TypeScript Specialist** → C2 (TypeScript Strict)
10. **Security Specialist** → C3 (Security Audit)

### Phase 4 Agents
11. **Technical Writer** → D1 (User Docs)
12. **Code Quality Specialist** → D2 (Code Docs)

**Note**: Agents can be reused across phases. Max concurrent: 4 agents in Phase 2.

---

## 🎯 Quality Gates

Each work stream must pass these gates before merge:

### Code Quality
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Code follows patterns in DEVELOPMENT_GUIDELINES.md
- [ ] No console.log() (use logger instead)

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] No regressions introduced

### Security
- [ ] All inputs validated with Zod schemas
- [ ] Commands sanitized before execution
- [ ] Paths validated (no traversal)
- [ ] Errors sanitized before display
- [ ] No credentials in logs

### Documentation
- [ ] JSDoc comments on public methods
- [ ] README updated if needed
- [ ] CHANGELOG entry added
- [ ] User-facing changes documented

### Git
- [ ] Branch created from `review-and-improve`
- [ ] Commits follow conventional format
- [ ] PR description complete
- [ ] Code reviewed and approved
- [ ] Merged to `review-and-improve` (not `main`)

---

## 📊 Success Metrics

### Adoption Metrics
- Number of sites using Node.js Orchestrator
- Number of apps managed per site
- Number of WordPress plugins installed via addon

### Performance Metrics
- App start time < 5 seconds
- UI responsiveness (no freezing)
- Memory usage < 100 MB per app
- Build time < 2 minutes for typical app

### Quality Metrics
- Code coverage > 80%
- Zero critical security vulnerabilities
- < 5 bugs per 100 users per month
- Mean time to resolution < 48 hours

### Developer Experience Metrics
- Time to add app: < 2 minutes
- User satisfaction score > 4.5/5
- GitHub stars growth
- Community contributions

---

## 🔮 Future Enhancements (Beyond v3.0)

### Advanced Features
- **Docker Support**: Run containerized Node.js apps
- **Remote Debugging**: Attach VS Code debugger
- **App Templates Marketplace**: Share app configurations
- **CI/CD Integration**: Deploy from Git on push
- **Scaling**: Multiple instance support
- **Service Mesh**: Inter-app communication
- **Health Dashboards**: Advanced monitoring
- **Resource Limits**: CPU/memory limits per app
- **Network Isolation**: Containerized networking
- **Secret Management**: Encrypted environment variables

### WordPress Integrations
- **WP-CLI Integration**: Run WP-CLI commands from UI
- **Database Migrations**: Run migrations on WP database
- **REST API Proxy**: Proxy Node.js requests to WP REST API
- **GraphQL Support**: WPGraphQL integration
- **Theme Development**: Support WP theme development workflow
- **Multisite Support**: Manage apps per subsite

---

## 🚨 Risk Mitigation

### Technical Risks
1. **Risk**: WP-CLI path changes in future Local versions
   - **Mitigation**: Detect WP-CLI path dynamically, don't hardcode

2. **Risk**: Monorepo subdirectory validation bypassed
   - **Mitigation**: Comprehensive path validation tests, security audit

3. **Risk**: WordPress plugin conflicts
   - **Mitigation**: Document plugin requirements, add conflict detection

4. **Risk**: Large repo clone times
   - **Mitigation**: Add timeout handling, progress indicators, cancellation

### Process Risks
1. **Risk**: Merge conflicts between parallel agents
   - **Mitigation**: Clear file ownership per work stream, daily syncs

2. **Risk**: Breaking changes between work streams
   - **Mitigation**: API contracts defined upfront, integration tests

3. **Risk**: Security vulnerabilities introduced
   - **Mitigation**: Security specialist reviews all PRs, automated scanning

---

## 📚 Resources for Developers

### Essential Reading
- `CONTEXT.md`: Project overview and architecture
- `DEVELOPMENT_GUIDELINES.md`: Coding standards and best practices
- `src/security/`: Security implementation examples
- Kitchen Sink addon: `/Users/jeremy.pollock/development/wpengine/local/addons/local-addon-kitchen-sink`

### Key Concepts
- **Local Hooks**: `siteStarted`, `siteStopping`, `siteDeleting`
- **IPC Patterns**: `ipcMain.handle()` with Zod validation
- **Process Spawning**: `spawn()` with `shell: false` for security
- **Local's Node.js**: `process.execPath` + `ELECTRON_RUN_AS_NODE='1'`
- **Hybrid npm**: System npm preferred, bundled npm fallback

### Development Commands
```bash
# Build TypeScript
npm run build

# Watch mode (auto-rebuild)
npm run watch

# Run tests
npm test

# Security audit
npm audit

# Type check
npm run type-check

# Link addon to Local
ln -sf $(pwd) ~/.config/Local/addons/local-addon-node-orchestrator
```

---

## 🎉 Definition of Done for v3.0

The project is ready for public release when:

- [x] v2.0.0 complete (current state)
- [ ] All Phase 1 work streams complete (A1, A2, A3)
- [ ] All Phase 2 work streams complete (B1, B2, B3, B4)
- [ ] All Phase 3 work streams complete (C1, C2, C3)
- [ ] All Phase 4 work streams complete (D1, D2)
- [ ] All quality gates passed
- [ ] All tests passing (80%+ coverage)
- [ ] Security audit passed
- [ ] User documentation complete
- [ ] Demo video created
- [ ] Blog post written
- [ ] GitHub release published
- [ ] npm package published (if applicable)

---

**Current Branch**: `review-and-improve`
**Target Branch for PRs**: `review-and-improve` (NOT `main`)
**Main Branch**: `main` (production releases only)
**Current Version**: v2.0.0
**Target Version**: v3.0.0
**Estimated Timeline**: 11 weeks
**Last Updated**: November 22, 2025
