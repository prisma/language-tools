#!/bin/sh

set -eu

EXTENSION_TYPE=$1
echo "EXTENSION_TYPE: $EXTENSION_TYPE"

if [ "$EXTENSION_TYPE" = "insider" ]; then
    TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_insider)
    RELEASE_CHANNEL="dev"
else
    TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_stable)
    RELEASE_CHANNEL="latest"
fi
echo "Last tested extension version: $TESTED_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

echo "::set-output name=version::$EXTENSION_VERSION"

if [ "$TESTED_VERSION" != "$EXTENSION_VERSION" ]; then
    echo "::set-output name=new_version::true"
else
    echo "CURRENT_VERSION ($EXTENSION_VERSION) and last tested version ($TESTED_VERSION) are same"
fi