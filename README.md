# Prisma Language Tools

Using the Language Server Protocol to improve Prisma's developer experience.

- [Prisma VSCode Extension](packages/vscode)
  - Install stable version of [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) from the VSCode marketplace
  - or install Insider version of [Prisma Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider) from the marketplace
- [Language Server implementation](packages/language-server)

## Repository Structure

```
.
├── packages
│   └── vscode
│       └── src
|           └── extension.ts // Language Client entry point
|   └── language-server      // Language Server
│       └── src
│           └── cli.ts    // Language Server CLI entry point
└── package.json         // The extension manifest
```
## Build Status
- E2E Tests Status

  ![E2E tests after release on VSIX](https://github.com/prisma/language-tools/workflows/E2E%20tests%20after%20release%20on%20VSIX/badge.svg?branch=main)

  ![E2E tests before Insider release](https://github.com/prisma/language-tools/workflows/5.%20Integration%20tests%20in%20VSCode%20folder%20with%20published%20LSP/badge.svg?branch=main)

- LSP Unit Tests Status

  ![Unit tests for LSP on `main`](https://github.com/prisma/language-tools/workflows/3.%20Unit%20tests%20for%20LSP%20and%20publish/badge.svg?branch=main)
