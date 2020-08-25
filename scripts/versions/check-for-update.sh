#!/bin/sh

set -eu

# get currently used Prisma CLI versions
CURRENT_PRISMA_DEV_VERSION=$(cat scripts/versions/prisma_dev)
CURRENT_PRISMA_LATEST_VERSION=$(cat scripts/versions/prisma_latest)
CURRENT_PRISMA_PATCH_DEV_VERSION=$(cat scripts/versions/prisma_patch)

echo "CURRENT_PRISMA_DEV_VERSION: $CURRENT_PRISMA_DEV_VERSION"
echo "CURRENT_PRISMA_LATEST_VERSION: $CURRENT_PRISMA_LATEST_VERSION"
echo "CURRENT_PRISMA_PATCH_DEV_VERSION: $CURRENT_PRISMA_PATCH_DEV_VERSION"

# get latest Prisma CLI versions from npm
NPM_PRISMA_DEV_VERSION=$(sh scripts/versions/npm-prisma-version.sh "dev")
NPM_PRISMA_LATEST_VERSION=$(sh scripts/versions/npm-prisma-version.sh "latest")
NPM_PRISMA_PATCH_DEV_VERSION=$(sh scripts/versions/npm-prisma-version.sh "patch-dev")

echo "NPM_PRISMA_DEV_VERSION: $NPM_PRISMA_DEV_VERSION"
echo "NPM_PRISMA_LATEST_VERSION: $NPM_PRISMA_LATEST_VERSION"
echo "NPM_PRISMA_PATCH_DEV_VERSION: $NPM_PRISMA_PATCH_DEV_VERSION"

if [ "$CURRENT_PRISMA_DEV_VERSION" != "$NPM_PRISMA_DEV_VERSION" ]; then
    echo "New Prisma CLI version for dev available."
    echo "::set-output name=dev-version::$NPM_PRISMA_DEV_VERSION"
fi

if [ "$CURRENT_PRISMA_LATEST_VERSION" != "$NPM_PRISMA_LATEST_VERSION" ]; then
    echo "New Prisma CLI version for latest available."
    echo "::set-output name=latest-version::$NPM_PRISMA_LATEST_VERSION"
fi

if [ "$CURRENT_PRISMA_PATCH_DEV_VERSION" != "$NPM_PRISMA_PATCH_DEV_VERSION" ]; then
    echo "New Prisma CLI version for patch-dev available."
    echo "::set-output name=patch-dev-version::$NPM_PRISMA_PATCH_DEV_VERSION"
fi
