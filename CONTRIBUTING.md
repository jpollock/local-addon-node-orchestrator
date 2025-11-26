# Contributing to Node.js Orchestrator

Thank you for your interest in contributing to the Node.js Orchestrator addon for Local!

## Development Setup

### Prerequisites

- Node.js 18 or higher
- Local (version 9.0.0 or higher)
- npm

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/getflywheel/local-addon-node-orchestrator.git
   cd local-addon-node-orchestrator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the addon:
   ```bash
   npm run build
   ```

4. For development with watch mode:
   ```bash
   npm run dev
   ```

### Installing in Local

1. Open Local
2. Go to Settings > Addons
3. Click "Install from disk"
4. Select the addon directory

## Code Style

This project uses ESLint and Prettier for code formatting.

### Linting

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Formatting

```bash
# Check formatting
npm run format:check

# Auto-format files
npm run format
```

### Type Checking

```bash
npm run type-check
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
src/
├── api/            # Public API exports
├── components/     # React components (renderer process)
├── hooks/          # Local hooks integration
├── ipc/            # IPC handlers
├── services/       # Core business logic
│   ├── managers/   # State managers
│   └── process/    # Process management
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── main-full.ts    # Main process entry point
└── renderer.tsx    # Renderer process entry point
```

## Architecture

### Main Process vs Renderer Process

Local addons run in two contexts:

- **Main Process** (`main-full.ts`): Node.js environment with full system access
- **Renderer Process** (`renderer.tsx`): Browser environment for UI

Communication between processes uses IPC (Inter-Process Communication).

### Service Container

The addon uses Local's service container for dependency injection:

```typescript
const { localLogger, siteData, wpCli } = LocalMain.getServiceContainer().cradle;
```

### Key Services

- **NodeAppManager**: Manages Node.js application lifecycle
- **ProcessManager**: Handles process spawning and monitoring
- **WpCliManager**: Executes WP-CLI commands via Local's service
- **WordPressPluginManager**: Manages bundled WordPress plugins

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Write clear, concise commit messages
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation if needed
6. Submit a pull request with a clear description

### Commit Message Format

```
type: description

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

## Logging

Use Local's structured logger instead of `console.log`:

```typescript
import LocalMain from '@getflywheel/local/main';

const { localLogger } = LocalMain.getServiceContainer().cradle;
const logger = localLogger.child({ addon: 'node-orchestrator' });

logger.info('Operation completed', { siteId, appId });
logger.error('Operation failed', { error: error.message });
```

## Questions?

If you have questions, please open an issue on GitHub.
