# Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           VS Code Extension                                │
│  packages/vscode/src/extension.ts                                          │
│                                                                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌───────────┐ │
│  │ Language Server │ │ Prisma Postgres │ │  Prisma Studio  │ │ AI Tools  │ │
│  │     Plugin      │ │     Manager     │ │     Plugin      │ │  Plugin   │ │
│  └────────┬────────┘ └─────────────────┘ └─────────────────┘ └───────────┘ │
│           │                                                                │
│           │ LSP over IPC                                                   │
└───────────┼────────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           Language Server                                  │
│  packages/language-server/src/server.ts                                    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         MessageHandler                               │  │
│  │        Dispatches LSP requests to appropriate handlers               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│           │                                                                │
│           ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       prisma-schema-wasm                             │  │
│  │      WebAssembly module for parsing/formatting .prisma files         │  │
│  │      (from @prisma/prisma-schema-wasm npm package)                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

## Key Prisma Dependencies

These are **internal Prisma packages** that provide core functionality:

| Package                       | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `@prisma/prisma-schema-wasm`  | WASM module for parsing/formatting/linting   |
| `@prisma/schema-files-loader` | Handles loading multi-file Prisma schemas    |
| `@prisma/config`              | Loads `prisma.config.ts` configuration files |

> **Note:** These dependencies are automatically updated via CI. A cron job
> runs every 5 minutes checking for new Prisma releases
> (see `.github/workflows/1_check_for_updates.yml`).

## File Organization

```
packages/
├── language-server/
│   └── src/
│       ├── __test__/                # Tests and fixtures
│       │   ├── __fixtures__/        # .prisma test files
│       │   └── *.test.ts            # Test files
│       ├── lib/
│       │   ├── ast/                 # AST utilities
│       │   ├── code-actions/        # Quick fixes
│       │   ├── completions/         # Completion providers
│       │   ├── prisma-schema-wasm/  # WASM wrapper functions
│       │   ├── MessageHandler.ts    # Main LSP request dispatcher
│       │   └── Schema.ts            # PrismaSchema class
│       └── server.ts                # LSP server entry point
│
└── vscode/
    └── src/
        ├── __test__/                # Extension tests
        ├── plugins/                 # Plugin modules
        │   ├── ai-tools/
        │   ├── prisma-language-server/
        │   ├── prisma-postgres-manager/
        │   └── prisma-studio/
        ├── extension.ts             # Extension entry point
        └── util.ts                  # Shared utilities
```
