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
  - [![E2E tests after release on VSIX](https://github.com/prisma/language-tools/workflows/E2E%20tests%20after%20release%20on%20VSIX/badge.svg?branch=main)](https://github.com/prisma/language-tools/actions/workflows/e2e_published_vsix.yml?query=branch%3Amain)
  - [![E2E tests before Insider release](https://github.com/prisma/language-tools/workflows/5.%20Integration%20tests%20in%20VSCode%20folder%20with%20published%20LS/badge.svg?branch=main)](https://github.com/prisma/language-tools/actions/workflows/5_e2e_tests.yml?query=branch%3Amain)
- Language Server Tests Status
  - [![Tests for Language Server on `main`](https://github.com/prisma/language-tools/workflows/3.%20Unit%20tests%20for%20LS%20and%20publish/badge.svg?branch=main)](https://github.com/prisma/language-tools/actions/workflows/3_LS_unit_tests_publish.yml?query=branch%3Amain)
