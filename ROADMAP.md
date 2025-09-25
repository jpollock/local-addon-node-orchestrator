# Node.js Orchestrator - Development Roadmap

## 🎯 Vision
Enable Local users to run Node.js applications alongside WordPress sites, making it easy to develop decoupled architectures, API services, and full-stack applications.

## ✅ Phase 1: Foundation (COMPLETED)
- [x] Basic addon structure with TypeScript
- [x] IPC communication between main/renderer
- [x] UI component in Site Overview
- [x] Test suite with Jest
- [x] Debug logging system

## 🚀 Phase 2: Process Management (NEXT)

### 2.1 Basic Process Control
```typescript
interface NodeApp {
  id: string;
  name: string;
  command: string;
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  pid?: number;
}
```

**Tasks:**
- [ ] Start Node.js process with spawn
- [ ] Stop process gracefully
- [ ] Track process status
- [ ] Handle process crashes

### 2.2 Port Management
- [ ] Auto-assign available ports
- [ ] Detect port conflicts
- [ ] Store port assignments
- [ ] Expose PORT environment variable

### 2.3 Process Monitoring
- [ ] Capture stdout/stderr
- [ ] Stream logs to UI
- [ ] Monitor CPU/memory usage
- [ ] Health check endpoints

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

## 🔒 Phase 7: Security & Reliability

### 7.1 Security
- [ ] Sandbox processes
- [ ] Resource limits
- [ ] Network isolation options
- [ ] Secret management

### 7.2 Reliability
- [ ] Health checks
- [ ] Auto-recovery
- [ ] Circuit breakers
- [ ] Graceful degradation

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

### Immediate (This Week)
1. Basic process spawn/kill
2. Port assignment
3. Simple start/stop UI

### Short Term (Next Month)
1. Log streaming
2. Express.js template
3. Environment variables
4. Status indicators

### Medium Term (3 Months)
1. Multiple apps
2. Auto-start
3. Health checks
4. Advanced UI

### Long Term (6+ Months)
1. Docker support
2. Marketplace
3. Advanced monitoring
4. Service mesh

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

## Getting Started with Development

```bash
# Current working example
npm run build
npm test

# Start developing Phase 2
# 1. Implement process spawning in main.ts
# 2. Add start/stop IPC handlers
# 3. Create UI controls in renderer.tsx
# 4. Test with a simple Node.js script
```

## Questions to Answer

1. How to handle Node.js version management?
2. Should we support npm/yarn/pnpm?
3. How to handle app crashes gracefully?
4. What's the best way to proxy requests?
5. Should we integrate with Local's router?

## Resources Needed

- [ ] Node.js process management best practices
- [ ] Electron IPC patterns
- [ ] Local's internal APIs documentation
- [ ] UI/UX design for process management
- [ ] Testing infrastructure

---

**Next Step**: Start with Phase 2.1 - Basic Process Control. Create a simple spawn/kill mechanism that can run a Node.js script and display its status in the UI.