# Testing

## Running All Tests

```bash
pnpm test  # runs unit tests in all packages (via Turborepo)
```

## Test Scripts Overview

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm test`          | Run unit tests in all packages (via Turborepo) |
| `pnpm test:e2e`      | VS Code E2E tests (before publishing)          |
| `pnpm test:e2e:vsix` | E2E tests on published VSIX                    |
| `pnpm test:scripts`  | Tests for CI scripts in `/scripts`             |

## Language Server Unit Tests

```bash
pnpm test  # from root, or:
cd packages/language-server
pnpm test
```

Tests use [Vitest](https://vitest.dev/) and are in `src/__test__/`.

### Cursor Position Convention

Tests use the `|` (pipe) character to indicate cursor position:

```typescript
// In test fixture files, | marks where the cursor is
const schema = `
model User {
  id Int @id
  name Str|  // cursor is here, testing completion
}
`
```

The `findCursorPosition()` helper extracts this position.

### Test Helpers

```typescript
// packages/language-server/src/__test__/helper.ts
import { getTextDocument, findCursorPosition } from './helper'

// For multi-file schema tests
import { getMultifileHelper } from './MultifileHelper'

// Loads fixtures from __fixtures__/multi-file/user-posts/
const helper = await getMultifileHelper('user-posts')
const userFile = helper.file('User.prisma')
```

## VS Code E2E Tests

```bash
pnpm test:e2e  # runs scripts/e2e.sh
```

Uses the VS Code test framework for E2E testing of the extension. The language
server is bundled with the extension, so tests always use the local version.

### Post-Publish E2E Testing

E2E tests run **after** the extension is published use a different script:

```bash
pnpm test:e2e:vsix <extension_type> <os> <version>
```

Both scripts use the same tests in `packages/vscode/src/__test__` with fixtures
located in `packages/vscode/fixtures`.

## VS Code Electron integration tests

The Electron runner opens `packages/vscode/tests/fixtures/integration-workspace.code-workspace`. Its roots include:

- Two pnpm importers with the lockfile-resolved real Prisma Next CLI at `node_modules/prisma/dist/prisma.js`.
- An additional marked-document fixture without that exact entrypoint, used to verify silent no-fallback behavior.

Run the focused minimum-runtime workspace suite with:

```bash
pnpm --filter prisma test:integration:workspace
```

This command rebuilds the extension, compiles the integration tests, launches the minimum supported VS Code version, and runs `workspace.test.js`. The test uses the real Prisma CLI process; no mock language-server executable is part of the fixture. It covers lazy activation, successful real-client initialization per root, root reuse and independence, exclusive bundled/local ownership, complete-text unsaved directive transfers, bundled diagnostic production and transfer-time clearing, and missing-entrypoint behavior. The current Prisma Next CLI does not publish schema diagnostics.

The runner's installed `@vscode/test-electron` version always adds `--disable-workspace-trust`, so the Electron workspace is deterministically trusted. It cannot represent Restricted Mode without replacing or bypassing the runner's launch contract. Trust rejection is therefore covered at the production classifier and registry boundaries by focused unit tests; a manual Restricted Mode check remains necessary when validating trust behavior end to end.

Routing observations are available only when `isDebugOrTestSession()` is true. The test command reports ownership/routing events and successful start counts. Complete document text and version are captured only by the optional test observer; production activation installs neither the collector nor the command, and no process handles are exposed.
