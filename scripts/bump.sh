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


CHANNEL=$1
echo "CHANNEL: $CHANNEL"

PRISMA_VERSION=$(sh scripts/prisma-version.sh "$CHANNEL")
echo "UPDATING to $PRISMA_VERSION"
echo "PRISMA_VERSION: $PRISMA_VERSION"

# TODO: remove this if-condition once we move to dev
if [ "$CHANNEL" = "dev" ]; then
    PRISMA_CHANNEL="alpha"
else
    PRISMA_CHANNEL="latest"
fi
echo "PRISMA_CHANNEL=$PRISMA_CHANNEL"

OLD_SHA=$(jq ".prisma.version" ./package.json)
SHA=$(npx -q -p @prisma/cli@"$PRISMA_CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

NPM_VERSION=$(sh scripts/prisma-version.sh "$CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION")
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

if [ "$CHANNEL" = "dev" ]; then
    echo "$PRISMA_VERSION" > scripts/prisma_version_unstable
else
    echo "$PRISMA_VERSION" > scripts/prisma_version_stable
fi

# If the channel is dev, we need to change the name, displayName to the dev extension
if [ "$CHANNEL" = "dev" ]; then
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma-dev\" | \
        .displayName = \"Prisma Dev\"" \
        ./package.json > ./package.json.bk
else
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"" \
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


if [ "$PRODUCTION" = "1" ]; then
        git add -A .
        git commit -m "bump prisma_version to $PRISMA_VERSION"
else
        echo "Not committing because production is not set"
fi