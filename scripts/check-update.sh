#!/bin/sh

set -eu

CURRENT_VERSION=$(cat scripts/prisma_version)
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "latest")
echo "NPM_VERSION: $NPM_VERSION"

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
    echo "$NPM_VERSION" > scripts/prisma_version
    sh ./scripts/bump-sha.sh
    git add -A .
    git commit -m "bump prisma_version to $NPM_VERSION"
    yarn run vsce:publish
else
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi