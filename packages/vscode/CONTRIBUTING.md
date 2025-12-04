# Contributing to Prisma VS Code Extension

## Getting Started

See the [Development Guide](../../docs/development.md) for setup instructions.

Quick start:

```bash
npm install && npm run bootstrap
npm run watch
```

Then press `F5` in VS Code → **Launch VS Code extension**.

## Documentation

- [Plugin System](../../docs/plugin-system.md) — Extension architecture
- [Testing](../../docs/testing.md) — Test patterns and helpers
- [Common Tasks](../../docs/common-tasks.md) — Adding features
- [CI/CD](../../docs/ci-cd.md) — Automated workflows

## Debugging

- Set `"prisma.trace.server": "messages"` or `"verbose"` in VS Code settings
  to trace communication between VS Code and the language server.
- Use the [Language Server Protocol Inspector][lsp-inspector] to visualize
  and filter LSP traffic (save logs from the output channel to a file).

[lsp-inspector]: https://microsoft.github.io/language-server-protocol/inspector

## Testing

Manual testing: see [TESTING.md](./TESTING.md).

E2E tests (Playwright):

```bash
npm run test  # from repository root
```

## Pull Requests

When you open a PR, the **PR Build extension** workflow automatically builds
and uploads a `pr<NUMBER>-prisma.vsix` file linked in a comment.

### Installing a PR Build

**Via UI:**

1. In Extensions, filter with `@installed prisma`
2. Disable Prisma and Prisma Insider extensions
3. **Extensions** → **...** → **Install from VSIX...**

**Via command line:**

```bash
# Download the artifact (replace <NUMBER> with PR number)
wget --content-disposition \
  "https://github.com/prisma/language-tools/blob/artifacts/pull-request-artifacts/pr<NUMBER>-prisma.vsix?raw=true"

# Install it
code --install-extension pr<NUMBER>-prisma.vsix

# Launch with marketplace extensions disabled
code --disable-extension Prisma.prisma --disable-extension Prisma.prisma-insider
```

### Cleanup After Testing

```bash
rm pr<NUMBER>-prisma.vsix
code --uninstall-extension Prisma.prisma-insider-pr-build
```

## Publishing

The extension is automatically published via GitHub Actions using an
[Azure DevOps Personal Access Token][pat-docs].

> **Note:** The token expires yearly and must be renewed manually.

[pat-docs]: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token

### Automatic Publishing

Upon any Prisma `dev` release a new insiders release of the extension is automatically performed.

Upon any Prisma `latest` release a new stable release of the extension is automatically performed.

### Manual Publishing (Extension-Only Release)

For releases that don't coincide with a Prisma ORM release:

**Insider release:**

- Push to `main` or a patch branch (e.g., `35.0.x`)
- Automatically triggers [`1/2. Bump versions for extension only`][bump-workflow]

**Stable release:**

- Manually trigger [`1/2. Bump and release a stable version`][stable-workflow]
- Select release type: `patch`, `minor`, or `major`

[bump-workflow]: ../../.github/workflows/1_2_bump_extension_only.yml
[stable-workflow]: ../../.github/workflows/1_2_stable_extension_release.yml

## Dependencies

The `@types/vscode` version must be ≤ the `engines.vscode` version in
`package.json`, otherwise the extension cannot be packaged.

## Resources

- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api)
- [Completion Item Kinds (icons)](https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions)
