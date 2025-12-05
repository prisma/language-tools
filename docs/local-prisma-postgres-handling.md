# Local Prisma Postgres (aka ppg dev) Handling

The extension supports running local Prisma Postgres instances using `@prisma/dev`.
Since these servers are long-running processes that shouldn't block the VS Code
extension host, they run in a **separate forked process**.

### Architecture

```
┌─────────────────────────────────────────┐
│           VS Code Extension             │
│                                         │
│  PrismaDevRepository.startInstance()    │
│            │                            │
│            │ fork()                     │
│            ▼                            │
│  ┌─────────────────────────────────┐    │
│  │   dist/workers/ppgDevServer.js  │    │
│  │                                 │    │
│  │   ┌─────────────────────────┐   │    │
│  │   │     @prisma/dev         │   │    │
│  │   │                         │   │    │
│  │   │  ┌───────────────────┐  │   │    │
│  │   │  │ @electric-sql/    │  │   │    │
│  │   │  │    pglite         │  │   │    │
│  │   │  └───────────────────┘  │   │    │
│  │   └─────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Worker Entry Point

The worker is defined in `src/workers/ppgDevServer.ts`. It:

1. Receives the database name as a CLI argument
2. Starts the `@prisma/dev` server
3. Communicates status back to the parent process via IPC (`process.send()`)
4. Handles graceful shutdown on `SIGTERM`/`SIGINT`

```typescript
// Simplified flow
const { unstable_startServer } = await import('@prisma/dev')
server = await unstable_startServer({ name, persistenceMode: 'stateful' })
process.send?.({ type: 'started' })
```

### Build Configuration

The worker is bundled separately by esbuild (see `packages/vscode/esbuild.mjs`):

```javascript
const ppgDevServerConfig = {
  entryPoints: ['src/workers/ppgDevServer.ts'],
  outfile: 'dist/workers/ppgDevServer.js',
  // ...
}
```

### Runtime Assets

PGlite (used internally by `@prisma/dev`) requires runtime assets that cannot be
bundled:

- `pglite.data` — PostgreSQL data file (~5MB)
- `pglite.wasm` — WebAssembly module (~11MB)

These are copied to `dist/workers/` during the build process so they're in the
same directory as the worker bundle and can be loaded via `__dirname`-relative paths.

### Forking the Worker

`PrismaDevRepository.startInstance()` forks the worker:

```typescript
const { fsPath } = Uri.joinPath(this.context.extensionUri, ...['dist', 'workers', 'ppgDevServer.js'])

const child = fork(fsPath, [name], {
  detached: true,
  stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
})

// Wait for startup confirmation
child.once('message', (message) => {
  if (message.type === 'started') {
    // Server is ready
  }
})

// Detach so the server keeps running after extension closes
child.disconnect()
child.unref()
```

## File Structure

```
plugins/prisma-postgres-manager/
├── ai-tools/                    # AI tool implementations
├── commands/                    # VS Code command handlers
│   ├── createProjectInclDatabase.ts
│   ├── createRemoteDatabase.ts
│   ├── deployPrismaDevInstance.ts
│   ├── launchStudio.ts
│   └── ...
├── management-api/              # Prisma Platform API client
├── shared-ui/                   # Shared UI utilities
├── ConnectionStringStorage.ts   # Secure credential storage
├── PrismaDevRepository.ts       # Local instance management
├── PrismaDevTreeDataProvider.ts # Tree view for local instances
├── PrismaPostgresRepository.ts  # Remote database management
├── PrismaPostgresTreeDataProvider.ts
└── index.ts                     # Plugin entry point
```

## Related Files

- `src/workers/ppgDevServer.ts` — Worker entry point (separate bundle)
- `esbuild.mjs` — Build configuration for worker bundle and asset copying
