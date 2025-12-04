<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">

[![Version][version-badge]][marketplace]
[![Installs][installs-badge]][marketplace]
[![Ratings][ratings-badge]][marketplace]

</div>
<hr>

Adds syntax highlighting, formatting, jump-to-definition and linting for
[Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
files.

## Installation

- [**Stable**][marketplace] — Recommended for most users
- [**Insider**][marketplace-insider] — Preview builds for testing

Also available on [Open VSX][openvsx] ([Insider][openvsx-insider]).

## Features

For the full feature list, see [scripts/README_STABLE_BUILD.md][readme-stable].

## Documentation

For development and architecture details, see:

- [Plugin System](../../docs/plugin-system.md) — Extension architecture
- [Development](../../docs/development.md) — Setup and debugging
- [Testing](../../docs/testing.md) — Test patterns
- [Common Tasks](../../docs/common-tasks.md) — Adding commands, code actions

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed workflow, including
how to test PR builds.

## Security

Report security issues to
[security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)

## Build Status

![E2E tests after release][e2e-vsix-badge]
![E2E tests before Insider release][e2e-insider-badge]

<!-- Links -->

[version-badge]: https://vsmarketplacebadge.apphb.com/version/prisma.Prisma.svg
[installs-badge]: https://vsmarketplacebadge.apphb.com/installs/prisma.Prisma.svg
[ratings-badge]: https://vsmarketplacebadge.apphb.com/rating/prisma.Prisma.svg
[marketplace]: https://marketplace.visualstudio.com/items?itemName=Prisma.prisma
[marketplace-insider]: https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider
[openvsx]: https://open-vsx.org/extension/Prisma/prisma
[openvsx-insider]: https://open-vsx.org/extension/Prisma/prisma-insider
[readme-stable]: ../../scripts/README_STABLE_BUILD.md
[e2e-vsix-badge]: https://github.com/prisma/language-tools/workflows/E2E%20tests%20after%20release%20on%20VSIX/badge.svg?branch=main
[e2e-insider-badge]: https://github.com/prisma/language-tools/workflows/5.%20Integration%20tests%20in%20VSCode%20folder%20with%20published%20LS/badge.svg?branch=main
