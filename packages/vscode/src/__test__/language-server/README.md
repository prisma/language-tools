# Integration tests for the Language Server

Only one test per feature is done here. The goal is to check that the integration is working between the VS Code extension and the Language Server.

The integration runner opens `tests/fixtures/integration-workspace.code-workspace`, a multi-root workspace. Its `integration-root-a` root is a pnpm workspace importer containing the lockfile-resolved real `prisma@8.0.0-rc.21` CLI with `@prisma/cli-engine@0.6.3` and `@prisma/orm-postgres@8.0.0-rc.16` (resolving `@prisma/orm-toolchain@8.0.0-rc.16`), plus a valid `prisma.config.ts` whose contract is only the marked `next.prisma` fixture.

Run the full minimum-and-latest integration suite with `pnpm test:integration`. Run the focused side-by-side completion suite on the minimum supported VS Code runtime with:

```bash
pnpm --filter prisma test:integration:workspace
```

The focused suite opens an empty, unmarked `legacy.prisma` and a marked `next.prisma` in separate editor columns. It polls only the public `vscode.executeCompletionItemProvider` command with a fixed timeout. The legacy Prisma 7 language server must offer `datasource`, `generator`, and `model`, classify `datasource` as `CompletionItemKind.Class`, and omit `namespace`. The real Prisma Next server launched from the workspace-local Prisma 8 CLI must offer `namespace` as `CompletionItemKind.Keyword` with detail `Groups declarations belonging to the same database schema or database.`, and omit `datasource`.

The `integration-npm`, `integration-yarn` and `integration-bun` roots under `tests/fixtures/package-managers` are installed by the runner with npm, Yarn (`node-modules` linker) and Bun before VS Code starts. One test per root checks that the Prisma Next server launched from that root's CLI offers `namespace` in `next.prisma`.

No mock language server or extension-private routing state is used. The test asserts observable editor behavior rather than owners, routing events, document synchronization bookkeeping, or process start counts.
