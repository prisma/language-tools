# Development Setup

## Quick Start

```bash
# Install all dependencies (uses pnpm workspaces)
pnpm install

# Build TypeScript
pnpm build

# Watch mode for development
pnpm watch
```

## Available Commands

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `pnpm install`  | Install all dependencies                                   |
| `pnpm build`    | Build all packages                                         |
| `pnpm watch`    | Watch mode for development                                 |
| `pnpm test`     | Run unit tests in all packages (via Turborepo)             |
| `pnpm test:e2e` | Run VS Code E2E tests                                      |
| `pnpm lint`     | Lint all packages                                          |
| `pnpm format`   | Format code with Prettier                                  |
| `pnpm clean`    | Remove untracked files and directories (incl node_modules) |

Commands are orchestrated by [Turborepo](https://turbo.build/). See
`turbo.json` for task dependencies.

## Build System (esbuild)

The VS Code extension uses [esbuild](https://esbuild.github.io/) for bundling
(see `packages/vscode/esbuild.mjs`). This produces optimized bundles for
production while supporting fast rebuilds during development.

### What Gets Bundled

The build produces two separate bundles:

1. **Extension bundle** (`dist/extension.js`) — The main VS Code extension code
2. **Language Server bundle** (`dist/language-server/bin.js`) — The LSP server

Both bundles are CommonJS format targeting Node.js 20.

### pnpm Symlink Resolution

pnpm uses a content-addressable store with symlinks, which can confuse esbuild's
module resolution. The build includes a custom `pnpm-resolve` plugin that:

- Intercepts bare module imports (e.g., `import x from 'some-package'`)
- Uses Node's native `require.resolve()` with explicit search paths
- Falls back to esbuild's resolution if the custom resolution fails

This ensures dependencies are correctly resolved from both the package's own
`node_modules` and the workspace root.

### Static Assets (Not Bundled)

Some dependencies cannot be bundled and must be copied as-is to the `dist`
folder:

#### 1. Prisma Studio (`@prisma/studio-core-licensed`)

**Location:** `dist/node_modules/@prisma/studio-core-licensed/`

**Why it can't be bundled:** Studio runs in a VS Code webview. At runtime, the
extension starts a local HTTP server that serves Studio's static files (CSS,
JS, images) to the webview. The webview loads these files via `<script>` and
`<link>` tags from URLs like `http://localhost:PORT/dist/ui/index.js`.

Since these assets are loaded dynamically by the browser (not imported by
Node.js), they must exist as physical files on disk that the HTTP server can
read and serve.

#### 2. Prisma 6 Language Server (`prisma-6-language-server`)

**Location:** `dist/node_modules/prisma-6-language-server/`

**Why it can't be bundled:** The extension supports a `prisma.pinToPrisma6`
setting that switches between the bundled (latest) language server and a
pinned Prisma 6 version. This allows users working on Prisma 6 projects to
get accurate language support.

Since users can switch between language servers at runtime via VS Code
settings, the Prisma 6 server must be kept as a separate, loadable module
rather than bundled into the main language server.

#### 3. WASM Module (`prisma_schema_build_bg.wasm`)

**Location:** `dist/language-server/prisma_schema_build_bg.wasm`

**Why it can't be bundled:** The `@prisma/prisma-schema-wasm` package uses
WebAssembly for parsing, formatting, and linting Prisma schemas. The WASM
binary is loaded at runtime using `__dirname`-relative paths.

When esbuild bundles the language server, all the JavaScript gets merged into
a single file, but the WASM file cannot be inlined. It must be placed in the
same directory as the bundled `bin.js` so that the relative path resolution
still works.

### Package Info Injection

The extension's `package.json` metadata (name, version) is injected at build
time via esbuild's `define` option:

```javascript
define: {
  __PACKAGE_JSON__: JSON.stringify({
    name: packageJson.name,
    version: packageJson.version,
  }),
}
```

This replaces `require('./package.json')` calls (which would fail in a bundle)
with static values, enabling telemetry and version reporting.

### Build Output Structure

```
packages/vscode/dist/
├── extension.js              # Main extension bundle
├── extension.js.map          # Source map (dev only)
├── language-server/
│   ├── bin.js                # Language server bundle
│   ├── bin.js.map            # Source map (dev only)
│   └── prisma_schema_build_bg.wasm  # WASM module
└── node_modules/
    ├── @prisma/
    │   └── studio-core-licensed/    # Studio UI assets
    └── prisma-6-language-server/    # Pinned LS for Prisma 6
```

## Running the Extension Locally

1. Open VS Code in this repository
2. Press `F5` or go to **Run and Debug** → **Launch VS Code extension**
3. A new VS Code window opens with the extension loaded
4. Open any `.prisma` file to test

## Debugging the Language Server

1. Start the extension (above)
2. In the debug panel, also run **Attach to Server**
3. Set `"prisma.trace.server": "verbose"` in VS Code settings for detailed logs
