<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">

[![Version](https://vsmarketplacebadge.apphb.com/version/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)

</div>
<hr>
Adds syntax highlighting, formatting, jump-to-definition and linting for Prisma Schema files.

## VSCode Marketplace

You can find both the [stable](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) and [Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider) extension on the Marketplace.

## Open VSX Registry

You can find both the [stable](http://open-vsx.org/extension/Prisma/prisma) and [Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider) extension on the Open VSX Registry.

## Features

- Syntax highlighting
- Code Completion
  - Completion results appear for symbols as you type.
  - You can trigger this manually with the `Ctrl+Space` shortcut.
- Documentation help
  - Information about the documentation of a completion result pops up as completion results are provided.
- Quick info on hover
  - Documentation Comments (`///`) of models and enums appear anywhere you hover over their usages.
- Go to Definition
  - Jump to or peek a model or enum's declaration.
- Formatting
  - Format code either manually or on save (if configured).
  - _To automatically format on save, add the following to your `settings.json` file:_
    ```
    "editor.formatOnSave": true
    ```
- Rename
  - Rename models, enums, fields and enum values
  - Click into the model or enum, press `F2` and then type the new desired name and press `Enter`
  - All usages will be renamed
  - Automatically applies `@map` or `@@map` on the schema
- Linting
  - Diagnostic tools are used to surface errors and warnings in your schema file as you type.
- Quick-fixes
  - Quickly fix typos in model and enum names
  - Create new models and enums with a single click

## Preview

<details>
  <summary>Syntax-Highlighting</summary>

![Preview Schema](https://i.imgur.com/W80iRwE.png)

</details>
<details>
  <summary>Quick-Fixes</summary>
  
![Quick-Fixes](https://media.giphy.com/media/iGGCF9JWOHx7SAKQlu/giphy.gif)
</details>

## Contributing

Read more about [how to contribute to the Prisma VSCode extension](./packages/vscode/CONTRIBUTING.md)

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
