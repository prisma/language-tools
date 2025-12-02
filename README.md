# Prisma Language Tools

Using the Language Server Protocol to improve Prisma's developer experience.

- [Prisma VS Code Extension](packages/vscode)

  - Install stable version (recommended) [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma):
    ![Prisma](https://img.shields.io/visual-studio-marketplace/v/Prisma.prisma)
  - or install the insider version (for Prisma developers) [Prisma Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider): ![Prisma Insider](https://img.shields.io/visual-studio-marketplace/v/Prisma.prisma-insider)

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
  - [![Tests for Language Server on `main`](https://github.com/prisma/language-tools/workflows/3.%20Unit%20tests%20for%20LS%20and%20publish/badge.svg?branch=main)](https://github.com/prisma/language-tools/actions/workflows/3_LS_tests_publish.yml?query=branch%3Amain)

## CI release pipeline

```mermaid
graph TD
    A(Cron every 5 minutes) --> B[1. Check for Prisma CLI Update]
    B -->|update available?| C[2. Bump versions]
    C -->D{Which NPM channel was updated?}
    D -->|dev or patch-dev| E((Our release_channel is insider))
    D -->|latest| F((Our release_channel is stable))
    E --> G[3. Test Language Server and publish]
    F --> G
    G -->|tests and publish successful?| H[4. Bump LS in VSCode extension]
    H --> I[5. Integration tests in VSCode folder with published LS]
    I -->|tests pass?| J[6. Build extension]
    J --> K[7. Publish]

    L(Commit in the extension) --> M[1/2. Bump versions for extension only]
    M -->E
    N(Manual workflow dispatch) --> O[1/2. Bump and release a stable version of the extension]
    O -->F
```
