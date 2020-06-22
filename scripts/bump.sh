#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . .envrc
else
    echo "No .envrc"
fi


RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

OLD_SHA=$(jq ".prisma.version" ./package.json)
SHA=$(npx -q -p @prisma/cli@"$RELEASE_CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

NPM_VERSION=$(sh scripts/prisma-version.sh "$RELEASE_CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"
echo "UPDATING to $NPM_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION")
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
        ./package.json > ./package.json.bk
else
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"| \
        .description = \"Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.\" | \
        .preview = false" \
        ./package.json > ./package.json.bk
    node scripts/change-readme.js "$RELEASE_CHANNEL"
fi

    echo "::set-output name=version::$NEXT_EXTENSION_VERSION"

jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
    .prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$NPM_VERSION\"" \
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


if [ "$PRODUCTION" = "1" ]; then
        git add -A .
        git commit -m "bump prisma_version to $NPM_VERSION"
else
        echo "Not committing because production is not set"
fi