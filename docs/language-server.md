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

// Loading with explicit schema path (from VS Code settings)
const schema = await PrismaSchema.load(
  {
    currentDocument: textDocument,
    allDocuments: documents.all(),
  },
  {
    schemaPath: '/path/to/schema/directory',
  }
)

// Iterating over all lines across files
for (const line of schema.iterLines()) {
  // line.document, line.lineIndex, line.text
}
```

### Schema Path Resolution

The language server determines the schema location in the following priority order:

1. **`schemaPath` option** (from VS Code `prisma.schemaPath` setting)
2. **`prisma.config.ts`** (discovered by searching upward from `schemaPath` or current document)
3. **Current document path** (fallback)

This matches the behavior of the Prisma CLI, ensuring consistency between IDE and command-line tooling.

### VS Code Configuration

Users can configure the schema path in `.vscode/settings.json`:

```json
{
  "prisma.schemaPath": "packages/backend/prisma"
}
```

This setting can point to:
- A directory containing multiple `.prisma` files
- A single `.prisma` file
- A relative path (from workspace root) or absolute path

See [Prisma Multi-File Schema Documentation][multi-file-docs] for details.

[multi-file-docs]: https://www.prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema
