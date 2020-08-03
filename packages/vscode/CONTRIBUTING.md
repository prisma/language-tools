# Contributing

## About this repository

The `master` branch of this repository contains the VS Code extension for Prisma schema files. Prisma package dependencies are kept up to date with a GitHub Action workflow, that updates them every time a new version of them is released.

There is a stable version `prisma` and an unstable version `prisma-dev`. The stable one is published as ["Prisma" in the VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma), the unstable one as ["Prisma Dev"](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-dev). An automated publish runs every 5 minutes calling the `check-update.sh` script.
In the beginning of this run, the CI job checks for Prisma stable version and `scripts/prisma_version_stable` contents to be the same. If the Prisma stable version is a new minor release, it makes the required version changes and proceeds further in the job. `scripts/prisma_version_stable` is a file that is committed by the stable CI job. That enables the future runs to know if an extension version is already published for a specific Prisma CLI version.

If there is a new Prisma Patch, a new patch branch from the last stable release tag is created if it does not exist yet. It then makes the required version changes and releases a new Insider extension. This script also triggers the release of a new Stable extension, incrementing the version number each time.
If the patch branch is created manually and something is pushed to it, another script runs, releasing what is on the patch branch to the Insider extension, incrementing the version number each time.
On push to the master branch, a new Insider extension is released, with an incremented version number each time.

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
- Select `Launch VSCode extension` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server` afterwards.
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

To do an extension only publish, please follow these steps:

1. Create a patch branch ending with `.x` if it doesn't exist yet.
2. Push to the patch branch with the changes.
3. Step 2 will trigger the script `patch-extension-only`, creating an Insider release
4. If you were satisfied, manually trigger GH action workflow `publish-patch-branch-to-stable` to release the patch to the stable extension
