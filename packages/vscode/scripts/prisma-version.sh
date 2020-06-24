#!/bin/sh

set -eu

NPM_TAG="$1"

yarn info "@prisma/cli@$NPM_TAG" --json | jq ".data[\"dist-tags\"].$NPM_TAG" | tr -d '"'