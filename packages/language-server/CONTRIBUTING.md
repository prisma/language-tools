# Contributing to Prisma Language Server

## Getting Started

See the [Development Guide](../../docs/development.md) for setup instructions.

Quick start:

```bash
pnpm install
pnpm watch
```

Then press `F5` in VS Code → **Launch VS Code extension**.

To debug the language server, also run **Attach to Server**.

## Testing

See the [Testing Guide](../../docs/testing.md) for patterns and helpers.

```bash
cd packages/language-server
pnpm test
```

## Publishing

The language server is automatically published to npm via GitHub Actions.
See [CI/CD](../../docs/ci-cd.md) for workflow details.

## Nix Users

The flake in this repository includes a language server package:

```bash
# Build the language server
nix build .#prisma-language-server

# Run directly
nix run .#prisma-language-server -- --stdio
```
