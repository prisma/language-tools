# Prisma Language Server

The Prisma Language Server implements the
[Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/)
to provide IDE features for Prisma schema files (`.prisma`).

## Installation

```bash
npm install -g @prisma/language-server
```

## Usage

```bash
# Run via stdio (for editor integration)
prisma-language-server --stdio
```

## Features

- **Diagnostics** — Real-time error and warning highlighting
- **Completions** — Context-aware suggestions for keywords, types, attributes
- **Hover** — Documentation on hover for models, fields, attributes
- **Go to Definition** — Jump to model/enum definitions
- **Document Formatting** — Format `.prisma` files
- **Code Actions** — Quick fixes for common issues
- **Rename** — Rename models, enums, fields with automatic `@map` handling
- **Document Symbols** — Outline view of models, enums, generators
- **References** — Find all usages of a model or enum

## Documentation

For development and architecture details, see:

- [Architecture](../../docs/architecture.md) — System design and file structure
- [Language Server](../../docs/language-server.md) — Key abstractions and internals
- [Development](../../docs/development.md) — Setup and debugging
- [Testing](../../docs/testing.md) — Test patterns and helpers

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow details.

## Security

Report security issues to
[security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
