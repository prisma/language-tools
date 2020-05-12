<br />

<div align="center">
  <h1>Prisma VS Code Extension</h1>
  <p><h3 align="center">Adds syntax highlighting, formatting, jump-to-definition and linting for `.prisma` files.</h3></p>
</div>

<hr>

<div align="center">
  
  ![CI tests](https://github.com/prisma/vscode/workflows/CI+tests/badge.svg)
  ![Check for Update + Automated Publish](https://github.com/prisma/vscode/workflows/Check+for+Update+%2B+Automated+Publish/badge.svg)
  
</div>

<hr>

This plugin is designed for [Prisma 2](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5). Information about the new datamodel syntax can be found [here](https://github.com/prisma/prisma2/blob/master/docs/data-modeling.md).

## Features

- Syntax highlighting
- Auto-formatting
- Linting
- Jump-to-definition
- Auto-completion (_coming soon_)

It also includes an End-to-End test.

## Install

- Get the Prisma Extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma).

## Preview

![](https://imgur.com/HbufPo6.png)

## Structure

```
.
--- client // Language Client
|   --- src
|       --- extension.ts // Language Client entry point
--- package.json // The extension manifest
--- server // Language Server
    --- src
        --- server.ts // Language Server entry point
```

## Development

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
- Run `yarn watch`.
- Open VS Code on this folder.
- Switch to the debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server` afterwards or select the launch configuration `Client + Server` at once.
- A new file should open in the [Extension Development Host] instance of VSCode.
- Change the language to Prisma.
- Make a change to the syntax
- To reload, press the reload button in VSCode ( **Developer: Inspect TM Scopes** is helpful for debugging syntax issues )

## Testing

Instructions on manual testing can be found [here](TESTING.md).

End-to-End tests:

- Run `npm install` in this folder.
- Open VS Code on this folder.
- Switch to the debug viewlet.
- Select `Language Server E2E Test` from the drop down.
- Run the launch config.
- Open the debug console to view the test results.

## Publishing

The extension is automatically published using a [Azure Devops Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) via Github actions (see `.github/workflows/publish.yml`).

Note that the personal access token is only valid for a year and will need to be renewed manually.

### Manual Publishing

To do a manual publish, please follow these steps:

1. Increment the package version
2. Update to latest pinned binary release in the [Prisma CLI's package.json](https://github.com/prisma/prisma2/blob/master/cli/prisma2/package.json) under **prisma.version**.
3. Run `yarn package`
4. Go to https://marketplace.visualstudio.com/manage/publishers/Prisma
5. Click the **��� More Actions**
6. Drag `prisma-x.x.x.vsix` into the browser and click upload.

This will take about an hour before the update is available.

## About this repository

The `master` branch of this repository contains the VS Code extension for Prisma schema files. Prisma package dependencies are kept up to date with a GitHub Action workflow, that updates them every time a new version of them is released.

There is a stable version `prisma` and an unstable version `prisma-dev`.