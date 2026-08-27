# Language Server Architecture

> **Note:** The language server implementation may be replaced with a new
> parser in the future. Focus on VS Code extension features for now.

## Key Files

| File                          | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `src/server.ts`               | Entry point, sets up LSP connection         |
| `src/lib/MessageHandler.ts`   | Dispatches LSP requests                     |
| `src/lib/Schema.ts`           | `PrismaSchema` class for multi-file schemas |
| `src/lib/prisma-schema-wasm/` | Wrappers around the WASM parsing module     |

## Multi-File Schema Support

Prisma supports splitting schemas across multiple `.prisma` files.
The `PrismaSchema` class handles this:

```typescript
// Loading a schema (handles both single and multi-file)
const schema = await PrismaSchema.load({
  currentDocument: textDocument,
  allDocuments: documents.all(),
})

// Iterating over all lines across files
for (const line of schema.iterLines()) {
  // line.document, line.lineIndex, line.text
}
```

See [Prisma Multi-File Schema Documentation][multi-file-docs] for details.

[multi-file-docs]: https://www.prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema

## VS Code document routing

Both the legacy language server and the Prisma Next language server (`prisma lsp`) receive every
open Prisma document through standard LSP document synchronization. The extension does not route
individual documents; each server decides locally, from current document content, whether to
respond:

- The legacy server ignores documents whose text starts with the `// use prisma-next` directive:
  it publishes empty diagnostics for them, returns empty results for feature requests, and
  excludes them from multi-file schema composition (see `isPrismaNextSchema` in
  `src/lib/prismaNext.ts`).
- The Prisma Next server applies the mirror-image filter and ignores documents without the
  directive. This requires `prisma@8.0.0-rc.8-dev.2` or later. The two servers share only this
  directive convention — neither depends on the other.

The directive is content-based and applies per file. A marked file does not opt sibling files or
the rest of a multi-file schema into Prisma Next tooling. Adding or removing the directive in an
open file switches which server responds without requiring a save or restart, because both
servers already track the document.

The extension only decides which servers to start. The two server kinds run side by side and
are counted independently:

- **At most one legacy server per window**, shared by all workspace folders. It starts once any
  open Prisma document needs it (no directive, or the workspace is pinned to Prisma 6).
- **At most one Prisma Next server per workspace folder.** It starts the first time an open
  document under that folder contains the directive. The workspace must be trusted, and the
  extension uses only the Prisma CLI installed at
  `<workspace-root>/node_modules/prisma/dist/prisma.js` — it does not invoke a package manager,
  search parent directories, or fall back to a global installation. If the CLI is unavailable,
  marked files have no language-server features until a suitable Prisma Next server can be
  started.

Either server may also not start at all, so a window runs between zero and `1 + <number of
workspace folders>` language-server processes. In the common case — a single-folder project
using Prisma 7 and Prisma Next schemas side by side — that means two processes: one legacy
server and one Prisma Next server.

Prisma Next servers do not restart automatically after a failure; use **Prisma: Restart Language
Server** to retry. Pinning the workspace to Prisma 6 (`prisma.pinToPrisma6`) starts the bundled
Prisma 6 server, which handles every Prisma document, and stops any Prisma Next servers.
