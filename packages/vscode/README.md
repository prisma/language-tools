<h1 align="center"><img src="./logo_white.png" alt="Logo" height="128" /></h1>
<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">

[![Version](https://vsmarketplacebadge.apphb.com/version/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)

</div>
<hr>
Adds syntax highlighting, formatting, jump-to-definition and linting for Prisma Schema files.

## Features

* Syntax highlighting
* Code Completion
    * Completion results appear for symbols as you type. 
    * You can trigger this manually with the Ctrl+Space shortcut.
* Documentation help
    * Information about the documentation of a completion result pops up as completion results are provided.
* Quick info on hover
    * Documentation Comments (`///`) of models and enums appear anywhere you hover over their usages.
* Go to Definition
    * Jump to or peek a model or enum's declaration.
* Formatting
    * Format code either manually or on save (if configured). 
    * *To automatically format on save, add the following to your `settings.json` file:*
        ```
        "editor.formatOnSave": true
        ```
* Linting
    * Diagnostic tools are used to surface errors and warnings in your schema file as you type.


It also includes an End-to-End test.

## Preview

![Preview Schema](https://i.imgur.com/W80iRwE.png)

## Contributing

Read more about [how to contribute to the Prisma VSCode extension](./CONTRIBUTING.md)

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
