#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . .envrc
else
    echo "No .envrc"
fi

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

echo "ENVIRONMENT: $ENVIRONMENT"
echo "============================"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    OLD_TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_insider)
else
    OLD_TESTED_VERSION=$(cat scripts/tests/tested_prisma_version_stable)
fi

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    echo "$EXTENSION_VERSION" >scripts/tests/tested_prisma_version_insider
else
    echo "$EXTENSION_VERSION" >scripts/tests/tested_prisma_version_stable
fi

echo "Bumped tested_prisma_version from $OLD_TESTED_VERSION to $EXTENSION_VERSION"

if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    git add -A .
    git commit -m "bump tested_prisma_version to $EXTENSION_VERSION"
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --ff-only
    git add ./scripts/tests/
    git push github HEAD:"${GITHUB_REF}"
else
    echo "Not committing because ENVIRONMENT is not set"
fi
