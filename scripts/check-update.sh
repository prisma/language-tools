#!/bin/sh

set -eu

CURRENT_VERSION=$(cat scripts/prisma_version)
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "latest")
echo "NPM_VERSION: $NPM_VERSION"

if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
    echo "UPDATING to $NPM_VERSION"
    echo "$NPM_VERSION" > scripts/prisma_version
    git add -A .
    git commit -m "bump prisma_version to $NPM_VERSION"
    yarn run vsce:publish
else
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi