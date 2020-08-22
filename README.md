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
