#!/bin/sh

set -eu

CHANNEL="$1"

# TODO: remove this if-condition once we move to dev
if [ "$CHANNEL" = "dev" ]; then
    CHANNEL="alpha"
fi

yarn info "@prisma/cli@$CHANNEL" --json | jq ".data[\"dist-tags\"].$CHANNEL" | tr -d '"'