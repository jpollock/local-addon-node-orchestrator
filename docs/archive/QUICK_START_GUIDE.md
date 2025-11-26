# Quick Start Guide - Node.js Orchestrator v3.0 Development

## 🎯 TL;DR

**Timeline**: 9 weeks (8 dev + 1 release)
**Team**: 3 developers working in parallel
**Strategy**: Phase-based development, test as you go, de-risk early

## 📅 Phase Overview

```
Week 1-2: WordPress Integration (Distinguishing Features) ⭐
  ├── WP Environment Variables Auto-Injection
  ├── Monorepo Support (subdirectories)
  └── WordPress Plugin Management
  → Deliverable: v2.1.0-beta.1

Week 3-4: Developer Experience Improvements
  ├── Package.json Script Detection
  ├── Better Error Messages & Validation
  └── Real-time Log Streaming
  → Deliverable: v2.2.0-beta.1

Week 5-6: Quality & Infrastructure
  ├── Comprehensive Test Suite (80%+ coverage)
  ├── TypeScript Strict Mode
  └── Security Audit & Hardening
  → Deliverable: v2.3.0-rc.1

Week 7-8: Modern UI & Polish
  ├── Modern React UI Refactor (hooks + JSX)
  ├── User Documentation
  └── Code Documentation & Cleanup
  → Deliverable: v3.0.0-rc.1

Week 9: Release
  └── Testing, prep, launch v3.0.0
```

## 👥 Team Assignments

### Developer A (Backend/Integration Focus)
- **Week 1-2**: WordPress Environment Variables (1.1)
- **Week 3-4**: Package.json Script Detection (2.1)
- **Week 5-6**: Comprehensive Test Suite (3.1)
- **Week 7-8**: Code Documentation & Cleanup (4.3)

### Developer B (Git/Security Focus)
- **Week 1-2**: Monorepo Support (1.2)
- **Week 3-4**: Better Error Messages (2.2)
- **Week 5-6**: Security Audit (3.3)
- **Week 7-8**: User Documentation (4.2)

### Developer C (WordPress/Frontend Focus)
- **Week 1-2**: WordPress Plugin Management (1.3) *starts Day 3*
- **Week 3-4**: Real-time Log Streaming (2.3)
- **Week 5-6**: TypeScript Strict Mode (3.2)
- **Week 7-8**: Modern React UI Refactor (4.1)

## 🚀 Week 1, Day 1 - Getting Started

### Morning (All Developers)
1. ✅ Read project documentation:
   - `CONTEXT.md` (architecture)
   - `ROADMAP.md` (original plan)
   - `EXECUTION_PLAN.md` (this detailed plan)
   - `DEVELOPMENT_GUIDELINES.md` (coding standards)

2. ✅ Set up development environment:
   ```bash
   cd /Users/jeremy.pollock/development/wpengine/local/addons/local-addon-node-orchestrator
   npm install
   npm run build
   # Test in Local
   ```

3. ✅ Manual testing of existing features:
   - Add a Node.js app
   - Start/stop app
   - View logs
   - Remove app

### Afternoon (Start Work Streams)

**Developer A** → Work Stream 1.1 (WP Env Injection):
```bash
git checkout sculptor/add-wp-env-auto-injection
git pull
git checkout -b feature/wp-env-injection

# Day 1 tasks:
# - Study Local's site object structure
# - Inspect real Local sites
# - Create src/lib/wordpress/ directory
# - Write WordPressEnvManager.ts skeleton
```

**Developer B** → Work Stream 1.2 (Monorepo Support):
```bash
git checkout sculptor/add-wp-env-auto-injection
git pull
git checkout -b feature/monorepo-support

# Day 1 tasks:
# - Design path validation strategy
# - Add subdirectory field to types
# - Create Zod schema for validation
# - Write path traversal attack tests
```

**Developer C** → Research for Work Stream 1.3:
```bash
# Day 1-2: Research only (start implementation Day 3)
# - Locate WP-CLI in Local
# - Test WP-CLI commands manually
# - Review Kitchen Sink addon
# - Plan WpCliManager architecture
```

## 📋 Daily Workflow

### Morning
1. **Pull latest changes**:
   ```bash
   git checkout sculptor/add-wp-env-auto-injection
   git pull
   git checkout feature/your-branch
   git merge sculptor/add-wp-env-auto-injection
   ```

2. **Daily standup** (15 min):
   - What did you complete yesterday?
   - What are you working on today?
   - Any blockers?

3. **Review overnight CI results**

### During Day
1. **Write code + tests together** (don't defer testing!)
2. **Commit frequently** with clear messages:
   ```bash
   git commit -m "feat: Add WordPress env extraction logic

   Extracts database credentials and site URLs from Local.Site object.

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. **Run tests before committing**:
   ```bash
   npm run build
   npm run type-check
   npm test
   ```

### End of Day
1. **Push your work**:
   ```bash
   git push origin feature/your-branch
   ```

2. **Update team** (async):
   - Post progress update
   - Flag any blockers for tomorrow
   - Document decisions made

## ✅ Quality Checklist (Before PR)

Every PR must include:
- [ ] Tests written (minimum 70% coverage for new code)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Security validated:
  - [ ] All inputs validated with Zod
  - [ ] Commands sanitized (`shell: false`)
  - [ ] Paths validated (no traversal)
  - [ ] Errors sanitized (no stack traces to user)
- [ ] Documentation updated:
  - [ ] JSDoc comments on public methods
  - [ ] README updated (if user-facing change)
  - [ ] CHANGELOG.md entry added
- [ ] Manual testing completed
- [ ] No regressions in existing features

## 🔒 Security Checklist

**Every feature must**:
1. ✅ Validate ALL inputs with Zod schemas
2. ✅ Sanitize commands before `spawn()` (use `shell: false`)
3. ✅ Validate file paths (no `..`, prevent traversal)
4. ✅ Sanitize errors before showing to user
5. ✅ Never log credentials or sensitive data

## 🧪 Testing Strategy

**Write tests alongside code** (not after!):

```typescript
// Example test structure
describe('WordPressEnvManager', () => {
  describe('extractWordPressEnv', () => {
    it('should extract database credentials', () => {
      const mockSite = createMockSite();
      const env = manager.extractWordPressEnv(mockSite);

      expect(env.WP_DB_HOST).toBe('localhost');
      expect(env.WP_DB_NAME).toBe('local');
      // ...
    });

    it('should not leak credentials in logs', () => {
      // Security test
    });
  });
});
```

**Test pyramid**:
- 70% unit tests (fast, isolated)
- 20% integration tests (IPC handlers)
- 10% E2E tests (full workflows)

## 🚨 Common Pitfalls to Avoid

### ❌ DON'T
```typescript
// Command injection vulnerability
spawn(`${userCommand} ${args}`, { shell: true });

// Path traversal vulnerability
const path = userInput; // No validation!

// Information disclosure
return { error: error.stack }; // Leaks internals

// Missing validation
ipcMain.handle('channel', async (event, data) => {
  // Use data directly without validation
});
```

### ✅ DO
```typescript
// Safe command execution
const [cmd, ...args] = validatedCommand;
spawn(cmd, args, { shell: false });

// Path validation
const validation = validate(pathSchema, userInput);
if (!validation.success) throw new Error();

// Safe error handling
const sanitized = logAndSanitizeError(logger, 'Op failed', error);
return { error: sanitized };

// Input validation
const validation = validate(schema, data);
if (!validation.success) return { error: validation.error };
```

## 🔄 Integration Points

### End of Each Week
- Merge feature branches to phase branch
- Run full test suite
- Manual integration testing

### End of Each Phase
- **1 day integration checkpoint**
- Merge phase branch to main branch
- Full regression testing
- Create beta/RC tag

## 📈 Success Metrics

### Phase 1 Goals
- ✅ WordPress env vars auto-injected
- ✅ Monorepo apps work from subdirectories
- ✅ WordPress plugins install/activate via Git
- ✅ 70%+ test coverage
- ✅ Zero high/critical security vulnerabilities

### Phase 2 Goals
- ✅ Scripts auto-detected from package.json
- ✅ Error messages are clear and actionable
- ✅ Logs stream in real-time
- ✅ 75%+ test coverage

### Phase 3 Goals
- ✅ 80%+ code coverage
- ✅ TypeScript strict mode enabled
- ✅ Security pen test passed
- ✅ Zero high/critical vulnerabilities

### Phase 4 Goals
- ✅ Modern React UI (if hooks work)
- ✅ Complete user documentation
- ✅ Demo video created
- ✅ All APIs documented

## 🎯 Critical Success Factors

1. **Test as you go** - Don't defer testing
2. **Communicate early** - Flag blockers immediately
3. **Integrate frequently** - Don't wait until the end
4. **Security first** - Validate all inputs
5. **Document decisions** - Future you will thank you

## 📞 Getting Help

### Stuck on implementation?
1. Check existing code for similar patterns
2. Review Kitchen Sink addon (reference implementation)
3. Check DEVELOPMENT_GUIDELINES.md
4. Ask in daily standup
5. Post in team chat with context

### Found a security issue?
1. Document the vulnerability privately
2. Create test to reproduce
3. Notify security specialist (Dev B in Phase 3)
4. Fix before merging

### Integration conflict?
1. Communicate with other developers
2. Decide on approach together
3. Update architecture docs
4. Merge carefully

## 🎉 Ready to Start?

### Pre-flight Checklist
- [ ] Development environment set up
- [ ] Can build and run addon in Local
- [ ] Understand project architecture (read CONTEXT.md)
- [ ] Know your work stream assignment
- [ ] Read relevant files for your feature
- [ ] Created feature branch

### Day 1 Kickoff
```bash
# All developers
git checkout sculptor/add-wp-env-auto-injection
git pull

# Create your feature branch
git checkout -b feature/your-work-stream

# Start building! 🚀
```

## 📚 Key Documents

- **CONTEXT.md** - Architecture and technical details
- **ROADMAP.md** - Original feature roadmap
- **EXECUTION_PLAN.md** - Detailed phase-by-phase plan (you are here!)
- **DEVELOPMENT_GUIDELINES.md** - Coding standards and best practices
- **QUICK_START_GUIDE.md** - This document

---

**Let's build something amazing! 🚀**

**Questions?** Review the docs above, or ask in daily standup.

**Current Branch**: `sculptor/add-wp-env-auto-injection`
**Target Version**: v3.0.0
**Timeline**: 9 weeks
**Start Date**: Week of November 22, 2025
