# Contributing to Prisma VS Code Extension

## Getting Started

See the [Development Guide](../../docs/development.md) for setup instructions.

Quick start:

```bash
pnpm install
pnpm watch
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

E2E tests:

```bash
pnpm test:e2e  # from repository root
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

### Prisma CLI updates

[`Check for Prisma CLI update`][check-workflow] polls npm and dispatches
[`Bump Prisma CLI`][bump-workflow] for each channel that has a new version. Its
cron schedule is currently disabled, so it has to be dispatched manually — as
does `Bump Prisma CLI` itself if you want to pin a specific version.

A bump pushed to `main` triggers an insider release. A stable release on the new
pins is always a separate manual dispatch.

### Publishing

**Insider release:**

- Push to `main`, which triggers [`Release`][release-workflow]
- For a patch branch (e.g. `35.0.x`), dispatch [`Release`][release-workflow]
  with channel `insider` and that branch as `ref`

**Stable release:**

- Manually dispatch [`Release`][release-workflow] with channel `stable`
- Select the bump: `patch`, `minor` or `major`
- To patch an older version, pass that `x.y.x` branch as `ref`. Without it the
  release is cut from `main`.

[release-workflow]: ../../.github/workflows/release.yml
[bump-workflow]: ../../.github/workflows/bump_prisma.yml
[check-workflow]: ../../.github/workflows/check_for_prisma_update.yml

## Dependencies

The `@types/vscode` version must be ≤ the `engines.vscode` version in
`package.json`, otherwise the extension cannot be packaged.

## Resources

- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api)
- [Completion Item Kinds (icons)](https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions)
