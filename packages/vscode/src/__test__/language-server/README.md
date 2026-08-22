# Integration tests for the Language Server

Only one test per feature is done here.
The goal is to check that the integration is working between the VS Code extension and the Language Server.

The integration runner opens `tests/fixtures/integration-workspace.code-workspace`, which contains two workspace roots. Each root is a pnpm workspace importer with the same lockfile-resolved real Prisma Next CLI at `node_modules/prisma/dist/prisma.js`.

Run the full minimum-and-latest integration suite with `pnpm test:integration`. To verify only the multi-root fixture substrate on the minimum supported VS Code runtime, run `pnpm test:integration:workspace`.
