#!/bin/sh

set -eu

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

NEW_EXTENSION_VERSION=$2
echo "NEW_EXTENSION_VERSION: $NEW_EXTENSION_VERSION"

NEW_PRISMA_VERSION=$3
echo "NEW_PRISMA_VERSION: $NEW_PRISMA_VERSION"



# If the RELEASE_CHANNEL is dev, we need to change the name, displayName, description and preview flag to the Insider extension
if [ "$RELEASE_CHANNEL" = "dev" ] || [ "$RELEASE_CHANNEL" = "patch-dev" ]; then
    jq ".version = \"$NEW_EXTENSION_VERSION\" | \
        .name = \"prisma-insider\" | \
        .displayName = \"Prisma - Insider\" | \
        .description = \"This is the Insider Build of the Prisma VSCode extension (only use it if you are also using the dev version of the CLI.\" | \
        .preview = true" \
    ./packages/vscode/package.json >./packages/vscode/package.json.bk
else
    jq ".version = \"$NEW_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"| \
        .description = \"Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.\" | \
        .preview = false" \
    ./packages/vscode/package.json >./packages/vscode/package.json.bk
fi

mv ./packages/vscode/package.json.bk ./packages/vscode/package.json

if [ "$NEW_PRISMA_VERSION" != "" ]; then
    SHA=$(npx -q @prisma/cli@"$NEW_PRISMA_VERSION" version --json | grep "format-binary" | awk '{print $3}')
    jq ".prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$NEW_PRISMA_VERSION\"" \
    ./packages/language-server/package.json >./packages/language-server/package.json.bk
fi

npm install
