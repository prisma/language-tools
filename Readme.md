# vscode

Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for `.prisma` files.

This plugin is designed for [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5). Information about the new datamodel syntax can be found [here](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md).

## Features

- Syntax highlighting
- Auto-formatting
- Linting
- Auto-completion (_coming soon_)
- Jump-to-definition (_coming soon_)

## Install

Get the Prisma Extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma).

## Preview

![](https://imgur.com/HbufPo6.png)

## Development

1. Run `yarn watch`
2. Open this repository in vscode
3. Press F5, a new file should open
4. Change the language to Prisma
5. Make a change to the syntax
6. To reload, press the reload button in VSCode
   1. **Developer: Inspect TM Scopes** is helpful for debugging syntax issues

## Publishing

The extension is automatically published using a [Azure Devops Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) via Github actions (see `.github/workflows/publish.yml`).

Note that the personal access token is only valid for a year and will need to be renewed manually.

### Manual Publishing

To do a manual publish, please follow these steps:

1. Increment the package version
2. Update to latest pinned binary release in the [Prisma CLI's package.json](https://github.com/prisma/prisma2/blob/master/cli/prisma2/package.json) under **prisma.version**.
3. Run `yarn package`
4. Go to https://marketplace.visualstudio.com/manage/publishers/Prisma
5. Click the **••• More Actions**
6. Drag `prisma-x.x.x.vsix` into the browser and click upload.

This will take about an hour before the update is available.
