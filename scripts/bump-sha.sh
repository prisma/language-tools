#!/bin/sh

set -eu

PRISMA_VERSION=$(cat scripts/prisma_version)
echo "PRISMA_VERSION: $PRISMA_VERSION"

CHANNEL=$1
echo "CHANNEL: $CHANNEL"

OLD_SHA=$(jq ".prisma.version" ./package.json)

SHA=$(npx -q -p @prisma/cli@"$CHANNEL" prisma2 --version | grep "Query Engine" | awk '{print $5}')

# If the channel is alpha, we need to change the name, displayName to the alpha extension
if [ "$CHANNEL" = "alpha" ]; then
    jq ".prisma.version = \"$SHA\" | .dependencies[\"@prisma/get-platform\"] = \"$PRISMA_VERSION\" | .name = \"prisma-alpha\" | .displayName = \"Prisma Alpha\"" ./package.json > ./package.json.bk
else
    jq ".prisma.version = \"$SHA\" | .dependencies[\"@prisma/get-platform\"] = \"$PRISMA_VERSION\"" ./package.json > ./package.json.bk
fi

mv ./package.json.bk ./package.json

echo "Bumped prisma.version in package.json from $OLD_SHA to $SHA"
