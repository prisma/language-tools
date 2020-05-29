#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . .envrc
else
    echo "No .envrc"

CHANNEL=$1
echo "CHANNEL: $CHANNEL"

if [ "$CHANNEL" = "dev" ]; then
    CURRENT_VERSION=$(cat scripts/prisma_version_unstable)
else
    CURRENT_VERSION=$(cat scripts/prisma_version_stable)
fi
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "$CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"

EXTENSION_VERSION=$(sh scripts/extension-version.sh "$CHANNEL" "")
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
    echo "::set-output name=new_updates::true"
else
    echo "::set-output name=new_updates::false"
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi