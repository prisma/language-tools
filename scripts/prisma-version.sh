#!/bin/sh

set -eu

NPM_TAG="$1"

# TODO: remove this if-condition once we move to dev
if [ "$NPM_TAG" = "dev" ]; then
    NPM_TAG="alpha"
fi

yarn info "@prisma/cli@$NPM_TAG" --json | jq ".data[\"dist-tags\"].$NPM_TAG" | tr -d '"'