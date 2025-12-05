# Build System (esbuild)

The VS Code extension uses [esbuild](https://esbuild.github.io/) for bundling
(see `packages/vscode/esbuild.mjs`). This produces optimized bundles for
production while supporting fast rebuilds during development.

> **Why bundling is required:** VS Code's extension host only supports `npm` and
> `yarn` for dependency resolution. Since this project uses `pnpm` (which creates
> a different `node_modules` structure with symlinks to a content-addressable store),
> the extension would fail to resolve dependencies at runtime without bundling.
> Bundling inlines all dependencies into single files, eliminating the need for
> runtime module resolution.

## What Gets Bundled

The build produces three separate bundles:

1. **Extension bundle** (`dist/extension.js`) — The main VS Code extension code
2. **Language Server bundle** (`dist/language-server/bin.js`) — The LSP server
3. **PPG Dev Server worker** (`dist/workers/ppgDevServer.js`) — Forked process for
   local Prisma Postgres instances

All bundles are CommonJS format targeting Node.js 20.

## pnpm Symlink Resolution

pnpm uses a content-addressable store with symlinks, which can confuse esbuild's
module resolution. The build includes a custom `pnpm-resolve` plugin that:

- Intercepts bare module imports (e.g., `import x from 'some-package'`)
- Uses Node's native `require.resolve()` with explicit search paths
- Falls back to esbuild's resolution if the custom resolution fails

This ensures dependencies are correctly resolved from both the package's own
`node_modules` and the workspace root.

## Static Assets (Not Bundled)

Some dependencies cannot be bundled and must be copied as-is to the `dist`
folder:

### 1. Prisma Studio (`@prisma/studio-core-licensed`)

**Location:** `dist/node_modules/@prisma/studio-core-licensed/`

**Why it can't be bundled:** Studio runs in a VS Code webview. At runtime, the
extension starts a local HTTP server that serves Studio's static files (CSS,
JS, images) to the webview. The webview loads these files via `<script>` and
`<link>` tags from URLs like `http://localhost:PORT/dist/ui/index.js`.

Since these assets are loaded dynamically by the browser (not imported by
Node.js), they must exist as physical files on disk that the HTTP server can
read and serve.

### 2. Prisma 6 Language Server (`prisma-6-language-server`)

**Location:** `dist/node_modules/prisma-6-language-server/`

**Why it can't be bundled:** The extension supports a `prisma.pinToPrisma6`
setting that switches between the bundled (latest) language server and a
pinned Prisma 6 version. This allows users working on Prisma 6 projects to
get accurate language support.

Since users can switch between language servers at runtime via VS Code
settings, the Prisma 6 server must be kept as a separate, loadable module
rather than bundled into the main language server.

### 3. WASM Module (`prisma_schema_build_bg.wasm`)

**Location:** `dist/language-server/prisma_schema_build_bg.wasm`

**Why it can't be bundled:** The `@prisma/prisma-schema-wasm` package uses
WebAssembly for parsing, formatting, and linting Prisma schemas. The WASM
binary is loaded at runtime using `__dirname`-relative paths.

When esbuild bundles the language server, all the JavaScript gets merged into
a single file, but the WASM file cannot be inlined. It must be placed in the
same directory as the bundled `bin.js` so that the relative path resolution
still works.

### 4. PGlite Assets (`pglite.data`, `pglite.wasm`)

**Location:** `dist/workers/pglite.data` and `dist/workers/pglite.wasm`

**Why they can't be bundled:** The PPG Dev Server worker uses `@prisma/dev`
which internally uses `@electric-sql/pglite` for local PostgreSQL emulation.
PGlite loads its data file and WASM module at runtime using `__dirname`-relative
paths.

Since the worker runs as a forked child process (separate from the main
extension), these assets must be in the same directory as the worker bundle
(`ppgDevServer.js`).

## Build Output Structure

```
packages/vscode/dist/
├── extension.js              # Main extension bundle
├── extension.js.map          # Source map (dev only)
├── language-server/
│   ├── bin.js                # Language server bundle
│   ├── bin.js.map            # Source map (dev only)
│   └── prisma_schema_build_bg.wasm  # WASM module
├── workers/
│   ├── ppgDevServer.js       # PPG Dev Server worker bundle
│   ├── ppgDevServer.js.map   # Source map (dev only)
│   ├── pglite.data           # PGlite data file
│   └── pglite.wasm           # PGlite WASM module
└── node_modules/
    ├── @prisma/
    │   └── studio-core-licensed/    # Studio UI assets
    └── prisma-6-language-server/    # Pinned LS for Prisma 6
```
