# Node.js Orchestrator - Development Roadmap

## 🎯 Vision
Enable Local users to run Node.js applications alongside WordPress sites, making it easy to develop decoupled architectures, API services, and full-stack applications.

## ✅ Phase 1: Foundation (COMPLETED - November 2025)

**Status**: 100% Complete

- [x] Basic addon structure with TypeScript
- [x] IPC communication between main/renderer using `ipcMain.handle()`
- [x] UI component in Site Overview (React class components)
- [x] Test suite with Jest
- [x] Debug logging system
- [x] All 8 IPC handlers working correctly
- [x] Site lifecycle hooks (siteStarted, siteStopping, siteDeleting)

## ✅ Phase 1.5: Security & Quality (COMPLETED - November 2025)

**Status**: 100% Complete - Production Ready

### Security Implementation
- [x] **Layer 1**: Zod input validation on all IPC handlers
- [x] **Layer 2**: Whitelist-based command validation
- [x] **Layer 3**: Path traversal protection
- [x] **Layer 4**: Error message sanitization

### Code Quality
- [x] Fixed React hooks crashes (converted to class components)
- [x] Comprehensive error handling
- [x] Structured logging with context
- [x] TypeScript strict typing (`unknown` for untrusted input)
- [x] Security documentation

### Files Created
- `src/security/validation.ts` - Command and path validation
- `src/security/schemas.ts` - Zod schemas for all requests
- `src/security/errors.ts` - Error sanitization utilities

### Testing
- [x] IPC handlers verified working
- [x] Validation tested with edge cases
- [x] Security layers tested for bypass attempts

## 🚀 Phase 2: Git Integration & App Setup (NEXT - Q1 2026)

**Status**: Not Started

**Goal**: Enable users to add Node.js apps from Git repositories with automatic dependency installation.

### 2.1 Git Repository Cloning

**Security Considerations**:
- Validate Git URLs (https://, git@, ssh://)
- Prevent command injection in git clone
- Validate branch names (no shell metacharacters)
- Sanitize repository URLs for logging

**Tasks**:
- [ ] Implement `GitManager.cloneRepository(url, branch, targetPath)`
- [ ] Add progress tracking for clone operations
- [ ] Handle authentication (SSH keys, personal access tokens)
- [ ] Validate cloned repository structure (package.json presence)
- [ ] Add timeout for long-running clones
- [ ] Handle git errors gracefully

**Implementation**:
```typescript
// src/lib/GitManager.ts
export class GitManager {
  async cloneRepository(
    url: string,
    branch: string,
    targetPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    // 1. Validate URL and branch
    // 2. Ensure target path is safe
    // 3. Execute git clone with validated parameters
    // 4. Emit progress events
    // 5. Verify package.json exists
  }
}
```

### 2.2 Dependency Installation

**Security Considerations**:
- Use validated install commands only
- Set timeout for installs
- Limit process resources
- Validate package manager lockfiles

**Tasks**:
- [ ] Auto-detect package manager (npm/yarn/pnpm/bun)
- [ ] Execute install command with progress updates
- [ ] Handle installation failures with retry logic
- [ ] Parse install output for progress reporting
- [ ] Cache node_modules when appropriate
- [ ] Verify installation success

**Implementation**:
```typescript
async installDependencies(
  appPath: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun',
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Validate install command
  // 2. Set resource limits
  // 3. Run install with validated command
  // 4. Stream output to UI
  // 5. Verify node_modules created
}
```

### 2.3 Build Process (Optional)

**Security Considerations**:
- Validate build commands
- Set build timeouts
- Capture build errors safely

**Tasks**:
- [ ] Execute build command if configured
- [ ] Stream build output to UI
- [ ] Handle build failures
- [ ] Verify build artifacts created

### 2.4 App Configuration UI Enhancement

**Tasks**:
- [ ] Git URL input with real-time validation
- [ ] Branch dropdown or input
- [ ] Auto-detect package.json scripts
- [ ] Command configuration with suggestions
- [ ] Environment variable key-value editor
- [ ] Port number input with availability check
- [ ] Progress UI for clone/install/build

### 2.5 Testing

- [ ] Integration tests for Git operations
- [ ] Mock git clone for unit tests
- [ ] Test install failures and recovery
- [ ] Validate security of all new operations
- [ ] E2E test: Add app from GitHub → Install → Start

## 📦 Phase 3: App Templates

### 3.1 Express.js Template
```json
{
  "name": "express-api",
  "command": "node server.js",
  "port": 3000,
  "healthCheck": "/health"
}
```

### 3.2 Next.js Template
```json
{
  "name": "nextjs-app",
  "command": "npm run dev",
  "port": 3000,
  "buildCommand": "npm run build"
}
```

### 3.3 Custom Scripts
- [ ] Support package.json scripts
- [ ] Custom start commands
- [ ] Environment variables
- [ ] Working directory configuration

## 🎨 Phase 4: UI Enhancement

### 4.1 Status Dashboard
```tsx
<NodeAppsList>
  <NodeApp
    name="API Server"
    status="running"
    port={3001}
    uptime="2h 15m"
  />
</NodeAppsList>
```

### 4.2 Controls
- [ ] Start/Stop buttons
- [ ] Restart functionality
- [ ] View logs button
- [ ] Open in browser

### 4.3 Configuration UI
- [ ] Add new app dialog
- [ ] Edit app settings
- [ ] Environment variables editor
- [ ] Port configuration

### 4.4 Log Viewer
- [ ] Real-time log streaming
- [ ] Log filtering
- [ ] Log search
- [ ] Export logs

## 🔧 Phase 5: Advanced Features

### 5.1 Lifecycle Management
- [ ] Auto-start apps with site
- [ ] Graceful shutdown on site stop
- [ ] Restart on crash
- [ ] Startup dependencies

### 5.2 Integration Features
- [ ] WordPress environment variables
- [ ] Database connection sharing
- [ ] Shared volumes
- [ ] nginx proxy configuration

### 5.3 Developer Tools
- [ ] Debugger attachment
- [ ] Performance profiling
- [ ] Network inspection
- [ ] Hot reload support

### 5.4 Multi-App Support
- [ ] Multiple apps per site
- [ ] App dependencies
- [ ] Shared configuration
- [ ] Service discovery

## 💾 Phase 6: Data Persistence

### 6.1 Configuration Storage
```typescript
interface SiteConfig {
  siteId: string;
  apps: NodeApp[];
  globalEnv: Record<string, string>;
  autoStart: boolean;
}
```

### 6.2 State Management
- [ ] Persist app configurations
- [ ] Remember port assignments
- [ ] Store process history
- [ ] Backup/restore configs

## 🔒 Phase 7: Enhanced Security & Reliability

**Note**: Core security already implemented in Phase 1.5

### 7.1 Advanced Security
- [ ] Process sandboxing (if feasible)
- [ ] Resource limits (CPU, memory)
- [ ] Network isolation options
- [ ] Secret management (encrypted env vars)
- [ ] Audit logging for sensitive operations
- [ ] Rate limiting on operations

### 7.2 Reliability Enhancements
- [ ] Health checks (already partially implemented)
- [ ] Auto-recovery from crashes
- [ ] Circuit breakers for failing apps
- [ ] Graceful degradation
- [ ] Process restart strategies
- [ ] Backup/restore configurations

## 📊 Phase 8: Monitoring & Analytics

- [ ] Resource usage tracking
- [ ] Performance metrics
- [ ] Error tracking
- [ ] Usage analytics

## 🔮 Future Ideas

- **Docker Support**: Run containerized Node.js apps
- **Remote Debugging**: Attach VS Code debugger
- **App Marketplace**: Share app templates
- **CI/CD Integration**: Deploy from Git
- **Scaling**: Multiple instance support
- **Service Mesh**: Inter-app communication

## Implementation Priority

### ✅ Completed (Q4 2025)
1. ✅ Phase 1: Foundation - Basic addon structure, IPC, UI
2. ✅ Phase 1.5: Security & Quality - 4-layer security architecture
3. ✅ All critical issues resolved
4. ✅ Production-ready foundation

### Immediate (Q1 2026)
**Phase 2: Git Integration & App Setup**
1. Git repository cloning with validation
2. Dependency installation with progress
3. Enhanced UI for app configuration
4. Build process support
5. Integration testing

### Short Term (Q2 2026)
**Phase 3 & 4: Templates & UI Enhancement**
1. Express.js and Next.js templates
2. Log streaming UI
3. Status dashboard
4. Environment variable management
5. Advanced UI controls

### Medium Term (Q3 2026)
**Phase 5: Lifecycle & Integration**
1. Auto-start with site
2. Multiple apps per site
3. WordPress integration features
4. Service discovery
5. Health monitoring

### Long Term (Q4 2026+)
**Phases 6-8: Advanced Features**
1. Docker support
2. App marketplace/templates
3. Advanced monitoring & analytics
4. Service mesh capabilities

## Success Metrics

- **Adoption**: Number of sites using Node.js apps
- **Reliability**: Uptime of managed processes
- **Performance**: Resource usage efficiency
- **Developer Satisfaction**: Time saved, ease of use
- **Community**: Templates shared, issues resolved

## Technical Decisions

### Process Management
- Use `child_process.spawn` for flexibility
- Implement process pooling for efficiency
- Use IPC for process communication

### Data Storage
- SQLite for app configurations
- File-based logs with rotation
- In-memory state with persistence

### UI Architecture
- React class components (no hooks)
- Real-time updates via IPC
- Responsive design

### Testing Strategy
- Unit tests for process management
- Integration tests for IPC
- E2E tests for UI workflows

## Getting Started with Phase 2 Development

**Prerequisites**: Phase 1 and 1.5 complete ✅

```bash
# Build the current codebase
npm run build

# Run existing tests
npm test

# Start developing Phase 2: Git Integration
# 1. Implement GitManager.cloneRepository() in src/lib/GitManager.ts
#    - Validate Git URL with existing validation patterns
#    - Use spawn() with shell: false for git clone
#    - Add progress event emitter
#
# 2. Add install functionality to NodeAppManager
#    - Auto-detect package manager
#    - Use validateInstallCommand() from security/validation.ts
#    - Stream install output to logs
#
# 3. Update AddAppModal.tsx for Git workflow
#    - Git URL input field
#    - Branch selection
#    - Progress indicator during clone/install
#
# 4. Add IPC handlers for clone/install operations
#    - Follow security pattern from main-full.ts
#    - Add schemas to security/schemas.ts
#
# 5. Test with real repositories
#    - Try cloning from GitHub
#    - Test various package managers
#    - Verify security validations
```

### Security Checklist for New Features

When implementing Phase 2, ensure:
- [ ] All new IPC handlers use Zod validation
- [ ] Git URLs validated before use
- [ ] Branch names validated (no shell metacharacters)
- [ ] All commands go through validateCommand()
- [ ] All paths go through validatePath()
- [ ] Errors sanitized with logAndSanitizeError()
- [ ] Operations logged with context
- [ ] Timeouts set for long-running operations

## Questions for Phase 2

1. How to handle Node.js version management?
   - Use Local's bundled Node.js or allow version selection?

2. Should we support all package managers?
   - Currently planned: npm, yarn, pnpm, bun

3. How to handle app crashes gracefully?
   - Auto-restart? Manual restart? Configurable?

4. What's the best way to proxy requests?
   - Direct port access or nginx integration?

5. Should we integrate with Local's router?
   - For custom domains: app.sitename.local?

## Resources

### Completed
- ✅ Node.js process management (spawn with security)
- ✅ Electron IPC patterns (ipcMain.handle)
- ✅ Security best practices (4-layer architecture)
- ✅ TypeScript patterns for validation

### Needed for Phase 2
- [ ] Git operations best practices
- [ ] Package manager detection algorithms
- [ ] Progress reporting patterns
- [ ] UI/UX for clone/install flows
- [ ] Integration testing strategies

---

**Current Status**: Phase 1 & 1.5 Complete ✅
**Next Phase**: Phase 2 - Git Integration & App Setup
**Timeline**: Q1 2026 Target
**Last Updated**: November 21, 2025