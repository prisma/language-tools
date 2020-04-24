# Release Workflow

## Trigger

Schedule (every 5 minutes) or push to `master` branch.

## Development

With `PRODUCTION=0` in environment, the script doesn't publish but outputs the commands that would be run. A publish is only triggered when `PRODUCTION=1` is set.

Entry point to test development is `yarn vsce:check <channel>`, where `channel=dev|latest`.

## Steps

1. Defined in the file `.github/workflows/publish.yml`
1. `yarn vsce:check <channel>` is run twice with "dev" and "latest" as channels respectively. Internally, it calls `check-update.sh <channel>`

Note the both `dev` workflow and `latest` workflow call the same scripts, the channel variable acts as a workflow discriminator as both workflows have slight differences, now we list the workflow steps in details:

### Dev workflow

1. `yarn vsce:check dev` calls `check-update.sh dev`
1. `check-update.sh` sets up the repo with Prismo bot as the user, all commits in the remainder of this workflow are attributed to Prismo.
1. `check-update.sh` compares `CURRENT_VERSION` (extension) against `NPM_VERSION` of Prisma CLI.
1. If they are same, this script exits
1. If they are different, `bump.sh <channel> <version>` is called with `channel=dev` and `version=NPM_VERSION` (i.e. the new version of extension to publish)
1. `bump.sh` updates the `package.json` files in root, client, server and sets `name`, `displayName`, `version`, `dependencies.@prisma/*` packages, and `prisma.version` values.
1. `check-update.sh` then commits these changes, this commit is required because `vsce publish` (to be run later requires a clean git state)
1. `yarn vsce:publish <channel> <version>` i.e. `publish.sh <channel> <version>` is then called with `channel=dev` and `version=NPM_VERSION` (i.e. the new version of extension to publish). This command publishes the "Prisma Dev" extension.
1. `publish.sh` pushes to vscode master repo. Only changes from the dev channel are pushed.

### Latest workflow

1. `yarn vsce:check latest` calls `check-update.sh latest`
1. `check-update.sh` sets up the repo with Prismo bot as the user, all commits in the remainder of this workflow are attributed to Prismo.
1. `check-update.sh` compares `CURRENT_VERSION` (extension) against `NPM_VERSION` of Prisma CLI.
1. If they are same, this script exits
1. If they are different, `bump.sh <channel> <version>` is called with `channel=latest` and `version=NPM_VERSION` (i.e. the new version of extension to publish)
1. `bump.sh` updates the `package.json` files in root, client, server and sets `name`, `displayName`, `version`, `dependencies.@prisma/*` packages, and `prisma.version` values.
1. `check-update.sh` then commits these changes, this commit is required because `vsce publish` (to be run later requires a clean git state)
1. `yarn vsce:publish <channel> <version>` i.e. `publish.sh <channel> <version>` is then called with `channel=latest` and `version=NPM_VERSION` (i.e. the new version of extension to publish). This command published the "Prisma" extension.
