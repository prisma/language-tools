# Prisma Language Support

Using the Language Server Protocol to improve Prisma's developer experience.
Server implementation can be found [here](packages/language-server).

## Structure

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

### VSCode
- install stable version of [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) from the marketplace ([plugin source](packages/vscode))
- or install insider version of [Prisma Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider) from the marketplace ([plugin source](packages/vscode))

