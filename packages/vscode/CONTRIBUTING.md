# Contributing

## About this repository

The `master` branch of this repository contains the VS Code extension for Prisma schema files. Prisma package dependencies are kept up to date with a GitHub Action workflow, that updates them every time a new version of them is released.

There is a stable version `prisma` and an unstable version `prisma-dev`. The stable one is published as ["Prisma" in the VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma), the unstable one as ["Prisma Dev"](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-dev). An automated publish runs every 5 minutes calling the `check-update.sh` script.
In the beginning of this run, the CI job checks for Prisma stable version and `scripts/prisma_version_stable` contents to be the same. If they are not the same, it makes the required version changes and proceeds further in the job. `scripts/prisma_version_stable` is a file that is committed by the stable CI job. That enables the future runs to know if an extension version is already published for a specific Prisma CLI version. The same workflow is done for Prisma unstable version, where the file checked in that case is `scripts/prisma_version_unstable` and in addition the respective `package.json` files are committed.

## Structure

```
.
├── packages
│   └── vscode
│       └── src
|           └── extension.ts // Language Client entry point
|   └── language-server      // Language Server
│       └── src
│           └── cli.ts    // Language Server CLI entry point
└── package.json         // The extension manifest
```

## Development

- Run `npm install` in the root folder. This installs all necessary npm modules in both the vscode and language-server folder.
- Run `npm run watch`.
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

- Run `npm install` in the root folder.
- Open VS Code on this folder.
- Switch to the debug viewlet.
- Select `Integration Tests` from the drop down.
- Run the launch config.
- Open the debug console to view the test results.

## Publishing

The extension is automatically published using a [Azure Devops Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) via Github actions (see `.github/workflows/publish.yml`).

Note that the personal access token is only valid for a year and will need to be renewed manually.

### Manual Publishing

To do a manual publish, please follow these steps:

1. Go to the language-server folder.
2. Increment the package version
3. Update to latest pinned binary release in the [Prisma CLI's package.json](https://github.com/prisma/prisma2/blob/master/cli/prisma2/package.json) under **prisma.version**.
4. Run `npm install`
5. Run `npm run build`
6. Run `npm publish`
7. Go to the vscode folder.
8. Incremement the package version.
9. Update to latest pinned binary release in the [Prisma CLI's package.json](https://github.com/prisma/prisma2/blob/master/cli/prisma2/package.json) under **prisma.version**.
10. Update the language server version to the version from step 2
11. Run `npm run package`
12. Go to https://marketplace.visualstudio.com/manage/publishers/Prisma
13. Click the **��� More Actions**
14. Drag `prisma-x.x.x.vsix` into the browser and click upload.

This will take about an hour before the update is available.
