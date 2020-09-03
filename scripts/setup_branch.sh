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

NPM_CHANNEL=$1

BRANCH=$(node scripts/setup_branch.js "$NPM_CHANNEL")
echo "BRANCH: $BRANCH"

git fetch

EXISTS_ALREADY=$(git ls-remote --heads origin "$BRANCH")
echo "$EXISTS_ALREADY"

if [ "${EXISTS_ALREADY}" = "" ]; then
    echo "Branch $BRANCH does not exist yet."

    if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
        NPM_VERSION=$(cat scripts/versions/prisma_latest)
        echo "NPM_VERSION to base new branch on: $NPM_VERSION"
        git config --global user.email "prismabots@gmail.com"
        git config --global user.name "Prismo"
        git checkout -b "$BRANCH" "$NPM_VERSION"
    else
        echo "Not setting up repo because ENVIRONMENT is not set"
    fi
else 
    git checkout "$BRANCH"
    echo "$BRANCH exists already."
fi