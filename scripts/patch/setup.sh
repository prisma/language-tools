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

NPM_VERSION=$(sh scripts/prisma-version.sh "latest")

PATCH_BRANCH=$(node scripts/patch/patch-branch.js "$NPM_VERSION")
echo "PATCH_BRANCH: $PATCH_BRANCH"


EXISTS_ALREADY=$(git ls-remote --heads origin "$PATCH_BRANCH")
echo "$EXISTS_ALREADY"

if [ "${EXISTS_ALREADY}" = "" ]; then
    echo "PATCH_BRANCH does not exist yet."

    if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
        git config --global user.email "prismabots@gmail.com"
        git config --global user.name "Prismo"
        git checkout -b "$PATCH_BRANCH" "$NPM_VERSION"
        git remote add github "https://$GITHUB_ACTOR:$GITHUB_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
    else
        echo "Not setting up repo because ENVIRONMENT is not set"
    fi
else 
    git checkout "$PATCH_BRANCH"
    echo "PATCH_BRANCH exists already."
fi