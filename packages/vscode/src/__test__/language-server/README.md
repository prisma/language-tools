# Integration tests for the Language Server

Only one test per feature is done here.
The goal is to check that the integration is working between the VS Code extension and the Language Server.

The integration runner opens `tests/fixtures/integration-workspace.code-workspace`. Two roots are pnpm workspace importers with the same lockfile-resolved real Prisma Next CLI at `node_modules/prisma/dist/prisma.js`; a third root intentionally has no local CLI entrypoint.

Run the full minimum-and-latest integration suite with `pnpm test:integration`. Run the focused real-CLI routing suite on the minimum supported VS Code runtime with:

```bash
pnpm --filter prisma test:integration:workspace
```

The focused suite verifies that activation and unmarked documents start no local process, each eligible marked root completes exactly one real client initialization handshake, additional documents reuse their root client, roots remain independent, and the missing-entrypoint root has no fallback process. It also observes exclusive bundled/local synchronization, both unsaved directive transfer directions, complete current text/version, and URI-scoped diagnostics clearing. The current Prisma Next CLI does not publish schema diagnostics, so diagnostic production is asserted only while the document is bundled; routing-state observations prove that those diagnostics are cleared during ownership transfers.

Test-only routing state is exposed through `prisma.test.languageServerRoutingState`. The command is registered only when `isDebugOrTestSession()` is true; production sessions do not install the observer or retain observed document contents. The state contains no process handles.

`@vscode/test-electron` adds `--disable-workspace-trust` unconditionally, so this harness always runs trusted. Restricted Mode execution remains a manual check; focused classifier and registry tests cover the untrusted production boundaries.
