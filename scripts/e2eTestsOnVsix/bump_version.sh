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

NEW_TESTED_VERSION=$2
echo "NEW TESTED VERSION: $NEW_TESTED_VERSION"

echo "ENVIRONMENT: $ENVIRONMENT"
echo "============================"

if [ "$RELEASE_CHANNEL" = "insider" ]; then
    OLD_TESTED_VERSION=$(cat scripts/versions/tested_extension_insider)
else
    OLD_TESTED_VERSION=$(cat scripts/versions/tested_extension_stable)
fi

if [ "$RELEASE_CHANNEL" = "insider" ]; then
    echo "$NEW_TESTED_VERSION" >scripts/versions/tested_extension_insider
else
    echo "$NEW_TESTED_VERSION" >scripts/versions/tested_extension_stable
fi

echo "Bumped tested_prisma_version from $OLD_TESTED_VERSION to $NEW_TESTED_VERSION"

if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    # Setup the repo with GH_TOKEN to avoid running jobs when CI commits
    git config --global user.email "prismabots@gmail.com"
    git config --global user.name "Prismo"
    git remote add github "https://$GITHUB_ACTOR:$GH_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true

    git add -A .
    git commit -m "bump tested_prisma_version to $NEW_TESTED_VERSION"
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --rebase
    git add ./scripts/
    git push github HEAD:"${GITHUB_REF}"
else
    echo "Not committing because ENVIRONMENT is not set"
fi