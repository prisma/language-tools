#!/bin/sh

set -eu

NPM_TAG=$1
echo "NPM_TAG: $NPM_TAG"

PRISMA_VERSION=$2
echo "PRISMA_VERSION: $PRISMA_VERSION"

# TODO: remove this if-condition once we move to dev
if [ "$NPM_TAG" = "dev" ]; then
    PRISMA_CHANNEL="alpha"
else
    PRISMA_CHANNEL="latest"
fi
echo "PRISMA_CHANNEL=$PRISMA_CHANNEL"

OLD_SHA=$(jq ".prisma.version" ./package.json)
SHA=$(npx -q -p @prisma/cli@"$PRISMA_CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

NEXT_EXTENSION_VERSION=$3
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

if [ "$NPM_TAG" = "dev" ]; then
    echo "$PRISMA_VERSION" > scripts/prisma_version_insider
else
    echo "$PRISMA_VERSION" > scripts/prisma_version_stable
fi

# If the npm_tag is dev, we need to change the name, displayName to the dev extension
if [ "$NPM_TAG" = "dev" ]; then
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma-insider\" | \
        .displayName = \"Prisma - Insider\" | \
        .description = \"This is the Insider Build.\" | \
        .preview = true" \
        ./package.json > ./package.json.bk
else
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"| \
        .description = \"Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.\" | \
        .preview = false" \
        ./package.json > ./package.json.bk
fi

jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
    .prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$PRISMA_VERSION\"" \
    ./server/package.json > ./server/package.json.bk

jq ".version = \"$NEXT_EXTENSION_VERSION\"" \
    ./client/package.json > ./client/package.json.bk

mv ./package.json.bk ./package.json
mv ./server/package.json.bk ./server/package.json
mv ./client/package.json.bk ./client/package.json

npm install

(
cd ./client
npm install
)

(
cd ./server
npm install
)

echo "Bumped prisma.version in package.json from $OLD_SHA to $SHA"
