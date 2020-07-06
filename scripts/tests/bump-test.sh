#!/bin/sh

set -eu

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    OLD_TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_insider)
else
    OLD_TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_stable)
fi

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
     echo "$EXTENSION_VERSION" >scripts/prisma_version_insider
else
    T echo "$EXTENSION_VERSION" >scripts/prisma_version_stable
fi

echo "Bumped tested_prisma_version from $OLD_TESTED_VERSION to $EXTENSION_VERSION"