#!/bin/sh

set -eu

EXTENSION_INSIDER_VERSION=$(./node_modules/.bin/vsce show Prisma.prisma-insider --json | jq ".versions[0].version" | tr -d '"')
echo "EXTENSION_INSIDER_VERSION: $EXTENSION_INSIDER_VERSION"

EXTENSION_STABLE_VERSION=$(./node_modules/.bin/vsce show Prisma.prisma --json | jq ".versions[0].version" | tr -d '"')
echo "EXTENSION_STABLE_VERSION: $EXTENSION_STABLE_VERSION"

# If env is undefined, log the following and exit
[ -z "$EXTENSION_INSIDER_VERSION" ] && echo "EXTENSION_INSIDER_VERSION is undefined, vsce show command failed, see logs."
[ -z "$EXTENSION_STABLE_VERSION" ] && echo "EXTENSION_STABLE_VERSION is undefined, vsce show command failed, see logs."

if [ -z "$EXTENSION_INSIDER_VERSION" ] || [ -z "$EXTENSION_STABLE_VERSION" ]
then
  exit 1
fi

echo "Currently published insider extension version: $EXTENSION_INSIDER_VERSION"
echo "Currently published stable extension version: $EXTENSION_STABLE_VERSION"

echo "::set-output name=insider_version::$EXTENSION_INSIDER_VERSION"
echo "::set-output name=stable_version::$EXTENSION_STABLE_VERSION"
