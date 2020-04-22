#!/bin/sh

set -eu

CHANNEL="$1"

if [ "$CHANNEL" = "alpha" ]; then
    vsce show Prisma.prisma-alpha --json | jq ".versions[0].version" | tr -d '"'
else
    vsce show Prisma.prisma --json | jq ".versions[0].version" | tr -d '"'
fi