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
