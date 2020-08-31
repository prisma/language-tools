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

BRANCH_CHANNEL=$1


BRANCH=$(node scripts/versions/setup-branch.js "$BRANCH_CHANNEL")
echo "BRANCH: $BRANCH"


EXISTS_ALREADY=$(git ls-remote --heads origin "$BRANCH")
echo "$EXISTS_ALREADY"

if [ "${EXISTS_ALREADY}" = "" ]; then
    echo "Branch $BRANCH does not exist yet."

    if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
        NPM_LATEST=$(cat scripts/versions/prisma_latest)
        git checkout -b "$BRANCH" "$NPM_LATEST"
        echo "Checked branch out to $BRANCH."       
    else
        echo "Not setting up repo because ENVIRONMENT is not set"
    fi
else 
    git checkout "$BRANCH"
    echo "Branch $BRANCH exists already."
    echo "Checked branch out to $BRANCH."
fi