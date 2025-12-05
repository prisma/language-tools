# Development Setup

## Quick Start

```bash
# Install all dependencies (uses pnpm workspaces)
pnpm install

# Build TypeScript
pnpm build

# Watch mode for development
pnpm watch
```

## Available Commands

| Command          | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `pnpm install`   | Install all dependencies                                   |
| `pnpm build`     | Build all packages                                         |
| `pnpm watch`     | Watch mode for development                                 |
| `pnpm test`      | Run unit tests in all packages (via Turborepo)             |
| `pnpm test:e2e`  | Run VS Code E2E tests                                      |
| `pnpm lint`      | Lint all packages                                          |
| `pnpm typecheck` | Type-check all packages with TypeScript                    |
| `pnpm format`    | Format code with Prettier                                  |
| `pnpm clean`     | Remove untracked files and directories (incl node_modules) |

Commands are orchestrated by [Turborepo](https://turbo.build/). See
`turbo.json` for task dependencies.

## Build System

The VS Code extension uses [esbuild](https://esbuild.github.io/) for bundling.
See [Build System](build-system.md) for details on:

- What gets bundled vs. copied as static assets
- pnpm symlink resolution
- Build output structure

## Running the Extension Locally

1. Open VS Code in this repository
2. Press `F5` or go to **Run and Debug** → **Launch VS Code extension**
3. A new VS Code window opens with the extension loaded
4. Open any `.prisma` file to test

## Debugging the Language Server

1. Start the extension (above)
2. In the debug panel, also run **Attach to Server**
3. Set `"prisma.trace.server": "verbose"` in VS Code settings for detailed logs
