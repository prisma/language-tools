#!/bin/sh

set -eu

CHANNEL="$1"
NEXT="$2"

if [ "$CHANNEL" = "dev" ]; then
    EXTENSION_VERSION=$(vsce show Prisma.prisma-insider --json | jq ".versions[0].version" | tr -d '"')
else
    EXTENSION_VERSION=$(vsce show Prisma.prisma --json | jq ".versions[0].version" | tr -d '"')
fi

if [ "$NEXT" = "patch" ]; then
    node -e "const semver = require('semver'); console.log(semver.inc('$EXTENSION_VERSION', 'patch'))"
else
    echo "$EXTENSION_VERSION"
fi