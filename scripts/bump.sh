#!/bin/sh

set -eu

CHANNEL=$1
echo "CHANNEL: $CHANNEL"

PRISMA_VERSION=$2
echo "PRISMA_VERSION: $PRISMA_VERSION"

OLD_SHA=$(jq ".prisma.version" ./package.json)
SHA=$(npx -q -p @prisma/cli@"$CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

# If the channel is dev, we need to change the name, displayName to the dev extension
if [ "$CHANNEL" = "dev" ]; then
    jq ".version = \"$PRISMA_VERSION\" | \
        .name = \"prisma-dev\" | \
        .displayName = \"Prisma Dev\"" \
        ./package.json > ./package.json.bk
else
    jq ".version = \"$PRISMA_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"" \
        ./package.json > ./package.json.bk
fi

jq ".version = \"$PRISMA_VERSION\" | \
    .prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$PRISMA_VERSION\" | \
    .dependencies[\"@prisma/fetch-engine\"] = \"$PRISMA_VERSION\" | \
    .dependencies[\"@prisma/sdk\"] = \"$PRISMA_VERSION\"" \
    ./server/package.json > ./server/package.json.bk

jq ".version = \"$PRISMA_VERSION\"" \
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
