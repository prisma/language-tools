#!/bin/sh

set -eu

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

NPM_VERSION=$2
echo "NPM_VERSION: $NPM_VERSION"

PRISMA_CHANNEL=$RELEASE_CHANNEL
echo "PRISMA_CHANNEL=$PRISMA_CHANNEL"

OLD_SHA=$(jq ".prisma.version" ./clients/vscode/package.json)
SHA=$(npx -q -p @prisma/cli@"$PRISMA_CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

NEXT_EXTENSION_VERSION=$3
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    echo "$NPM_VERSION" > scripts/prisma_version_insider
else
    echo "$NPM_VERSION" > scripts/prisma_version_stable
fi

# If the RELEASE_CHANNEL is dev, we need to change the name, displayName, description and preview flag to the Insider extension
if [ "$RELEASE_CHANNEL" = "dev" ]; then
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma-insider\" | \
        .displayName = \"Prisma - Insider\" | \
        .description = \"This is the Insider Build of the Prisma VSCode extension (only use it if you are also using the $(dev) version of the CLI.\" | \
        .preview = true" \
        ./clients/vscode/package.json > ./clients/vscode/package.json.bk
else
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"| \
        .description = \"Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.\" | \
        .preview = false" \
        ./clients/vscode/package.json > ./clients/vscode/package.json.bk
fi

jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
    .prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$NPM_VERSION\"" \
    ./server/package.json > ./server/package.json.bk

mv ./server/package.json.bk ./server/package.json
mv ./clients/vscode/package.json.bk ./clients/vscode/package.json

npm install

(
cd ./clients/vscode
npm install
)

(
cd ./server
npm install
)

echo "Bumped prisma.version in clients/vscode/package.json from $OLD_SHA to $SHA"
