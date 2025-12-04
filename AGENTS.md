# Agent Guide for Prisma Language Tools

This document helps AI coding agents understand and work effectively in
this repository.

## Project Overview

This is the **Prisma Language Tools** monorepo—the official VS Code extension
and Language Server for [Prisma](https://www.prisma.io/), the popular
TypeScript ORM. The extension provides IDE features for `.prisma` schema
files: syntax highlighting, completions, formatting, diagnostics, hover
information, go-to-definition, and more.

### Packages

| Package                   | Path                       | Purpose                        |
| ------------------------- | -------------------------- | ------------------------------ |
| `@prisma/language-server` | `packages/language-server` | LSP implementation             |
| `prisma` (VS Code ext)    | `packages/vscode`          | VS Code extension with plugins |

## Documentation

| Document                                   | Description                           |
| ------------------------------------------ | ------------------------------------- |
| [Architecture](docs/architecture.md)       | System design and file organization   |
| [Development](docs/development.md)         | Setup and debugging instructions      |
| [Plugin System](docs/plugin-system.md)     | VS Code extension plugin architecture |
| [Language Server](docs/language-server.md) | LSP implementation details            |
| [Testing](docs/testing.md)                 | Test patterns and helpers             |
| [Common Tasks](docs/common-tasks.md)       | How to add features                   |
| [CI/CD](docs/ci-cd.md)                     | GitHub Actions workflows              |
| [Gotchas](docs/gotchas.md)                 | Important tips and warnings           |

## Quick Start

```bash
# Install all dependencies (uses Lerna for monorepo)
npm install && npm run bootstrap

# Build TypeScript
npm run build

# Watch mode for development
npm run watch
```

Then press `F5` in VS Code to launch the extension in debug mode.

## Key Points

- **Plugin-based architecture** — The VS Code extension uses a plugin system.
  See [Plugin System](docs/plugin-system.md) for details.

- **Multi-file schema support** — Prisma schemas can span multiple files.
  Always use `PrismaSchema.load()` instead of assuming a single file.

- **Language server may change** — The LS implementation may be replaced with
  a new parser. Focus on VS Code extension features for now.

- **Dependencies auto-update** — Don't manually bump `@prisma/*` packages.
  CI handles this via cron jobs.

- **Test cursor convention** — Tests use `|` to mark cursor position for
  testing completions, hover, etc.

- **Keep documentation up to date** — When making changes to the codebase,
  update relevant documentation in the `docs/` folder and any README files.
  If you add new features, modify architecture, or change workflows, ensure
  the corresponding docs reflect those changes.
