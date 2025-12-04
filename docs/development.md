# Development Setup

## Quick Start

```bash
# Install all dependencies (uses Lerna for monorepo)
npm install && npm run bootstrap

# Build TypeScript
npm run build

# Watch mode for development
npm run watch
```

## Running the Extension Locally

1. Open VS Code in this repository
2. Press `F5` or go to **Run and Debug** → **Launch VS Code extension**
3. A new VS Code window opens with the extension loaded
4. Open any `.prisma` file to test

## Debugging the Language Server

1. Start the extension (above)
2. In the debug panel, also run **Attach to Server**
3. Set `"prisma.trace.server": "verbose"` in VS Code settings for detailed logs
