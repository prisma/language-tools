#!/bin/sh

set -eu

OLD_SHA=$(jq ".prisma.version" ./package.json)

SHA=$(npx -p @prisma/cli@latest prisma2 --version | grep "Query Engine" | awk '{print $5}')
jq ".prisma.version = \"$SHA\"" ./package.json > ./package.json.bk
mv ./package.json.bk ./package.json

echo "Bumped prisma.version in package.json from $OLD_SHA to $SHA"