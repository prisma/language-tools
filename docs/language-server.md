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

When `prisma.pinToPrisma6` is disabled, the VS Code extension routes each open Prisma document independently:

| Document                                                                          | Owner                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| No `// use prisma-next` directive                                                 | Legacy language server                     |
| Directive present, trusted file workspace, matching root, and local CLI available | Prisma Next client for that workspace root |
| Directive present but local execution is ineligible or unavailable                | No active language-server synchronization  |

The directive is content based and applies per file. A marked file does not opt sibling files or the rest of a multi-file schema into Prisma Next tooling.

### Coordinator and synchronization boundary

`DocumentOwnershipCoordinator` is the authoritative per-URI state machine. `desiredOwner` is computed from the document's current text and workspace policy; `settledOwner` records the server synchronized only after a serialized transition's commit closure completes. Open and change events are serialized per document. A transfer performs these operations in order:

1. Close the prior synchronized owner.
2. Clear that owner's diagnostics for only the transferred URI.
3. Reclassify current unsaved text.
4. Lazily ensure the candidate Prisma Next client for the exact workspace root when needed.
5. Reclassify after asynchronous startup.
6. Open the complete current document on the surviving owner.
7. Record the successfully synchronized candidate as the settled owner, or `unowned` if no candidate opened.

A close event invalidates pending revisions immediately and queues final cleanup. Its settled owner becomes `unowned` only after the cleanup commit closure completes. Candidate opens also check that the exact `TextDocument` remains in `workspace.textDocuments`. These checks prevent delayed startup or close operations from reopening an editor document that has already closed.

Legacy and Prisma Next middleware maintain ledgers of documents actually synchronized to their client. Raw editor notifications, feature requests, and diagnostics are forwarded only when `getSettledOwner(document.uri)` and `getDesiredOwner(document)` agree on the middleware's expected identity and, for Prisma Next, the exact workspace root. Completion and completion resolve, hover, definition, references, document symbols, formatting, rename, code actions, and diagnostics use this same gate. Automatic Prisma Next client initial synchronization is suppressed until the coordinator explicitly opens an owned document, so unmarked contents are never sent to Prisma Next over LSP.

### Workspace-root Prisma Next launch contract

The Prisma Next client registry is keyed by `WorkspaceFolder.uri.toString()` and coalesces concurrent startup for one root. Discovery checks only:

```text
<workspace-root>/node_modules/prisma/dist/prisma.js
```

The registry does not invoke a package manager, search parent directories, inspect package boundaries, or fall back to a global executable. Local execution requires `workspace.isTrusted` and a file-backed document in a file-backed workspace folder.

The extension launches the module with the extension-host runtime using the exact process shape:

```text
executable: process.execPath
argv:       [<workspace-root>/node_modules/prisma/dist/prisma.js, "lsp"]
cwd:        <workspace-root>
stdio:      piped
shell:      false
```

Electron extension hosts receive `ELECTRON_RUN_AS_NODE=1` and `ELECTRON_NO_ASAR=1`. The custom server-options launcher avoids transport arguments that `vscode-languageclient` would otherwise append.

### Registry lifecycle contract

The registry exposes a narrow lifecycle API used by routing and later workspace lifecycle handling:

- `ensureClientForDocument(document)` — trust/root checks, exact discovery, and coalesced lazy startup.
- `openDocument(rootUri, document)` — verifies the document is still open before inserting it into the Prisma Next middleware ledger.
- `closeDocument(rootUri, document)` — idempotently balances an actually synchronized Prisma Next document.
- `clearDiagnostics(rootUri, uri)` — clears only the requested URI.

A started Prisma Next client currently remains alive after its final marked document closes. Workspace-wide restart and rediscovery, runtime-failure recovery, workspace-folder removal, comprehensive deactivation, and live Prisma 6 pin transitions are separate lifecycle responsibilities that should build on this API rather than bypass the coordinator or middleware ledgers.

Routing is covered end to end through public completion behavior. In one workspace root, the Electron integration test opens an unmarked document served by the legacy Prisma 7 language server beside a marked document served by the real Prisma Next server from the workspace-local Prisma 8 CLI. The legacy document offers `datasource`, `generator`, and `model` but not `namespace`; the marked document offers the Prisma 8 `namespace` keyword but not `datasource`. The test does not expose or inspect coordinator ownership, routing events, or client startup counts.
