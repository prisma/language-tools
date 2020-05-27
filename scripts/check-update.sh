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

NPM_TAG=$1
echo "NPM_TAG: $NPM_TAG"

if [ "$NPM_TAG" = "dev" ]; then
    CURRENT_VERSION=$(cat scripts/prisma_version_insider)
else
    CURRENT_VERSION=$(cat scripts/prisma_version_stable)
fi
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "$NPM_TAG")
echo "NPM_VERSION: $NPM_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$NPM_TAG" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

# Setup the repo with GH_TOKEN to avoid running jobs when CI commits
if [ "$PRODUCTION" = "1" ]; then
    git config --global user.email "prismabots@gmail.com"
    git config --global user.name "Prismo"
    git remote add github "https://$GITHUB_ACTOR:$GH_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
else
    echo "Not setting up repo because PRODUCTION is not set"
fi

if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
    echo "UPDATING to $NPM_VERSION"

    NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION")
    echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

    sh ./scripts/bump.sh "$NPM_TAG" "$NPM_VERSION" "$NEXT_EXTENSION_VERSION"
    if [ "$PRODUCTION" = "1" ]; then
        git add -A .
        git commit -m "bump prisma_version to $NPM_VERSION"
    else
        echo "Not committing because production is not set"
    fi
    yarn run vsce:publish "$NPM_TAG" "$NPM_VERSION" "$NEXT_EXTENSION_VERSION"
else
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi