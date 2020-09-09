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

COMMIT_MESSAGE=$1
echo "COMMIT_MESSAGE: $COMMIT_MESSAGE"

BRANCH=$2
echo "BRANCH: $BRANCH"

git add -A .
git commit -am "$COMMIT_MESSAGE"
git pull --rebase
git push $BRANCH
