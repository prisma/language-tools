# Testing

## Language Server Unit Tests

```bash
cd packages/language-server
npm test
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
npm run test  # runs scripts/e2e.sh
```

Uses Playwright for browser-based E2E testing of the extension.

### CI E2E Testing

When running E2E tests in GitHub Actions before publishing, `scripts/e2e.sh` is
executed. By default, the **published** Language Server is used. Adding the
`useLocalLS` parameter runs tests with the local Language Server instead:

```bash
sh scripts/e2e.sh useLocalLS
```

The E2E tests run **after** the extension is published use a different script:
`scripts/e2eTestsOnVsix/test.sh`.

Both scripts use the same tests in `packages/vscode/src/__test__` with fixtures
located in `packages/vscode/fixtures`.
