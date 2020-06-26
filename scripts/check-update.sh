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

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    CURRENT_VERSION=$(cat scripts/prisma_version_insider)
else
    CURRENT_VERSION=$(cat scripts/prisma_version_stable)
fi
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "$RELEASE_CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

# Setup the repo with GH_TOKEN to avoid running jobs when CI commits
if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    git config --global user.email "prismabots@gmail.com"
    git config --global user.name "Prismo"
    git remote add github "https://$GITHUB_ACTOR:$GH_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
else
    echo "Not setting up repo because ENVIRONMENT is not set"
fi

if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then

    NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION")
    echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"
    echo "::set-output name=new_updates::true"
else
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi