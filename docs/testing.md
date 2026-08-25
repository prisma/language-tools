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

The Electron runner opens `packages/vscode/tests/fixtures/integration-workspace.code-workspace`. Its single workspace root is a pnpm importer with the lockfile-resolved `prisma@8.0.0-rc.10-dev.82` CLI at `node_modules/prisma/dist/prisma.js`. The fixture uses `@prisma/cli-engine@0.2.3` and `@prisma/orm-postgres@8.0.0-rc.7-dev.1` (which resolves `@prisma/orm-toolchain@8.0.0-rc.7-dev.1`) plus a valid `prisma.config.ts` whose contract is only `next.prisma`.

Run the focused minimum-runtime workspace suite with:

```bash
pnpm --filter prisma test:integration:workspace
```

This command rebuilds the extension, compiles the integration tests, launches the minimum supported VS Code version, and runs `workspace.test.js`. The test uses the bundled language server and the real workspace-local Prisma CLI process side by side; no mock language-server executable is part of the fixture.

The test opens an empty, unmarked `bundled.prisma` and a marked `next.prisma` in separate editor columns, then polls only the public `vscode.executeCompletionItemProvider` command with a fixed timeout. At `(0, 0)`, the bundled server must offer `datasource`, `generator`, and `model`, classify `datasource` as `CompletionItemKind.Class`, and omit `namespace`. At `(1, 0)`, the local Prisma 8 server must offer `namespace` as `CompletionItemKind.Keyword` with detail `PSL declaration keyword`, and omit `datasource`. These assertions verify observable routing behavior without extension-private commands, owner state, events, or process start counts.
