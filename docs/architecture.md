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

## Build System

The VS Code extension uses **esbuild** to bundle the extension, language server,
and worker processes into optimized JavaScript bundles. See
[Build System](build-system.md) for details on the bundling configuration and
why certain assets cannot be bundled.

## Key Prisma Dependencies

These are **internal Prisma packages** that provide core functionality:

| Package                        | Purpose                                    | Bundled? |
| ------------------------------ | ------------------------------------------ | -------- |
| `@prisma/prisma-schema-wasm`   | WASM module for parsing/formatting/linting | Partial¹ |
| `@prisma/schema-files-loader`  | Handles loading multi-file Prisma schemas  | Yes      |
| `@prisma/config`               | Loads `prisma.config.ts` configuration     | Yes      |
| `@prisma/studio-core-licensed` | Prisma Studio UI (webview)                 | No²      |
| `@prisma/dev`                  | Local Prisma Postgres development server   | Partial³ |
| `prisma-6-language-server`     | Pinned Prisma 6 language server            | No⁴      |

¹ JS is bundled; WASM binary is copied separately (loaded at runtime via
`__dirname`)

² Served as static files to the webview at runtime; cannot be inlined into
a bundle

³ Bundled into separate worker (`dist/workers/ppgDevServer.js`); PGlite
assets (`pglite.data`, `pglite.wasm`) are copied separately

⁴ Kept separate to support runtime switching between Prisma 6 and latest
language servers via the `prisma.pinToPrisma6` setting

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
        ├── workers/                 # Separate process entry points
        │   └── ppgDevServer.ts      # Prisma Postgres local dev server
        ├── extension.ts             # Extension entry point
        └── util.ts                  # Shared utilities
```
