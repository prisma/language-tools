#!/bin/sh

set -eu




EXTENSION_INSIDER_VERSION=$(./node_modules/.bin/vsce show Prisma.prisma-insider --json | jq ".versions[0].version" | tr -d '"')
EXTENSION_STABLE_VERSION=$(./node_modules/.bin/vsce show Prisma.prisma --json | jq ".versions[0].version" | tr -d '"')

echo "Currently published insider extension version: $EXTENSION_INSIDER_VERSION"
echo "Currently published stable extension version: $EXTENSION_STABLE_VERSION"

echo "::set-output name=insider_version::$EXTENSION_INSIDER_VERSION"
echo "::set-output name=stable_version::$EXTENSION_STABLE_VERSION"
