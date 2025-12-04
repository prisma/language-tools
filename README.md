# Prisma Language Tools

VS Code extension and Language Server for [Prisma](https://www.prisma.io/) schema files.

- [**Prisma** (stable)][marketplace]
  ![Version](https://img.shields.io/visual-studio-marketplace/v/Prisma.prisma)
- [**Prisma Insider** (preview)][marketplace-insider]
  ![Version](https://img.shields.io/visual-studio-marketplace/v/Prisma.prisma-insider)

[marketplace]: https://marketplace.visualstudio.com/items?itemName=Prisma.prisma
[marketplace-insider]: https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider

## Packages

| Package                                                | Description                    |
| ------------------------------------------------------ | ------------------------------ |
| [`packages/vscode`](packages/vscode)                   | VS Code extension with plugins |
| [`packages/language-server`](packages/language-server) | LSP implementation             |

## Quick Start

```bash
pnpm install
pnpm build
pnpm watch
```

Press `F5` in VS Code to launch the extension in debug mode.

### Available Commands

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `pnpm build`    | Build all packages                                         |
| `pnpm watch`    | Watch mode                                                 |
| `pnpm test`     | Run unit tests in all packages (via Turborepo)             |
| `pnpm test:e2e` | Run VS Code E2E tests                                      |
| `pnpm lint`     | Lint all packages                                          |
| `pnpm clean`    | Remove untracked files and directories (incl node_modules) |

## Documentation

| Document                                                        | Description                           |
| --------------------------------------------------------------- | ------------------------------------- |
| [AGENTS.md](./AGENTS.md)                                        | Overview for AI agents                |
| [Architecture](docs/architecture.md)                            | System design and file organization   |
| [Development](docs/development.md)                              | Setup and debugging instructions      |
| [Build System](docs/build-system.md)                            | esbuild bundling and static assets    |
| [Plugin System](docs/plugin-system.md)                          | VS Code extension plugin architecture |
| [Language Server](docs/language-server.md)                      | LSP implementation details            |
| [Local Prisma Postgres](docs/local-prisma-postgres-handling.md) | Local dev server and worker process   |
| [Testing](docs/testing.md)                                      | Test patterns and helpers             |
| [Common Tasks](docs/common-tasks.md)                            | How to add features                   |
| [CI/CD](docs/ci-cd.md)                                          | GitHub Actions workflows              |
| [Gotchas](docs/gotchas.md)                                      | Important tips and warnings           |

## Build Status

[![E2E tests after release][e2e-vsix-badge]][e2e-vsix-action]
[![E2E tests before Insider release][e2e-insider-badge]][e2e-insider-action]
[![Language Server tests][ls-tests-badge]][ls-tests-action]

[e2e-vsix-badge]: https://github.com/prisma/language-tools/workflows/E2E%20tests%20after%20release%20on%20VSIX/badge.svg?branch=main
[e2e-vsix-action]: https://github.com/prisma/language-tools/actions/workflows/e2e_published_vsix.yml?query=branch%3Amain
[e2e-insider-badge]: https://github.com/prisma/language-tools/workflows/5.%20Integration%20tests%20in%20VSCode%20folder%20with%20published%20LS/badge.svg?branch=main
[e2e-insider-action]: https://github.com/prisma/language-tools/actions/workflows/5_e2e_tests.yml?query=branch%3Amain
[ls-tests-badge]: https://github.com/prisma/language-tools/workflows/3.%20Unit%20tests%20for%20LS%20and%20publish/badge.svg?branch=main
[ls-tests-action]: https://github.com/prisma/language-tools/actions/workflows/3_LS_tests_publish.yml?query=branch%3Amain
