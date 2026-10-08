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

| Document                                                                                | Handled by                             |
| --------------------------------------------------------------------------------------- | -------------------------------------- |
| Neither `// use prisma-next` nor `// use prisma-8` directive                            | Legacy language server                 |
| Directive present, trusted file workspace, matching root, and Prisma Next CLI available | Prisma Next server for the nearest CLI |
| Directive present but Prisma Next execution is ineligible or unavailable                | No language-server features            |

The directives `// use prisma-next` and `// use prisma-8` are equivalent. The directive must appear at the start of the file (optionally preceded by whitespace), is content-based, and applies per file. A marked file does not opt sibling files or the rest of a multi-file schema into Prisma Next tooling.

For marked files, the extension uses the nearest Prisma CLI, searching from the directory of the file up to its workspace root:

```text
<directory>/node_modules/prisma/dist/prisma.js
```

In a monorepo this selects the CLI of the package that contains the schema (for example `apps/api/node_modules/prisma`) before the one at the workspace root. The server runs with the directory that contains the selected `node_modules` as its working directory and handles the Prisma documents under that directory.

The CLI must be a Prisma version that supports the `lsp` command and directive-based document filtering. The workspace must be trusted. The extension does not search above the workspace root or fall back to a global installation. If no CLI is found, the extension offers to install `prisma@latest` at the workspace root; until a suitable Prisma Next server can be started, the marked file has no language-server features.

The extension starts at most one Prisma Next language server per directory with an installed CLI, in addition to the single legacy server shared by the whole window. Adding or removing the directive in an open file switches which server handles it without requiring a save or restart. Prisma Next servers do not restart automatically after a failure; use **Prisma: Restart Language Server** to retry. Pinning the workspace to Prisma 6 routes every Prisma document to the legacy Prisma 6 server.
