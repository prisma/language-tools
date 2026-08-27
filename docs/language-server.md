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

When `prisma.pinToPrisma6` is disabled, each open Prisma document is handled independently:

| Document                                                                                | Handled by                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| No `// use prisma-next` directive                                                        | Legacy language server                     |
| Directive present, trusted file workspace, matching root, and Prisma Next CLI available  | Prisma Next server for that workspace root |
| Directive present but Prisma Next execution is ineligible or unavailable                 | No language-server features                |

The directive is content-based and applies per file. A marked file does not opt sibling files or the rest of a multi-file schema into Prisma Next tooling.

For marked files, the extension uses only the Prisma CLI installed at:

```text
<workspace-root>/node_modules/prisma/dist/prisma.js
```

The CLI must be `prisma@8.0.0-rc.8-dev.2` or later. The workspace must be trusted. The extension does not invoke a package manager, search parent directories, or fall back to a global installation. If the CLI is unavailable, the marked file has no language-server features until a suitable Prisma Next server can be started.

The extension starts at most one Prisma Next language server per workspace root, in addition to the single legacy server shared by the whole window. Adding or removing the directive in an open file switches which server handles it without requiring a save or restart. Prisma Next servers do not restart automatically after a failure; use **Prisma: Restart Language Server** to retry. Pinning the workspace to Prisma 6 routes every Prisma document to the legacy Prisma 6 server.
