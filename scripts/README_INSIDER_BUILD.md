<h1 align="center"><img src="./logo_white.png" alt="Logo" height="128" /></h1>
<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">

[![Version](https://vsmarketplacebadge.apphb.com/version/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider)

![CI tests](https://img.shields.io/github/workflow/status/prisma/vscode/CI%20tests/master.svg?label=CI%20tests&logo=github)
![Check for Update + Automated Publish](https://img.shields.io/github/workflow/status/prisma/vscode/Check%20for%20Update%20%2B%20Automated%20Publish/master.svg?label=Check%20for%20Update%20%2B%20Automated%20Publish&logo=github)


</div>
<hr>

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


## Insider Build

This is the Insider Build of the [Prisma VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma). Most users should not use this version, but instead install
the regular version of the extension.This version of the extension may contain unstable prerelease code and is directly built from the master branch. 

**Only use this extension if you are also using the dev version of the CLI.**

Please note that you should not have the regular and insider version of the extension installed at the same time.

## Build information

This version is built from commit [$commit-sha$]($commit-sha$).

## Contributing

Read more about [how to contribute to the Prisma VSCode extension](./CONTRIBUTING.md)

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
