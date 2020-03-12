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

echo "============================"
echo "PAT: $PAT"
echo "PRODUCTION: $PRODUCTION"
echo "============================"

# Setup the repo with GH_TOKEN to avoid running jobs when CI commits
if [ "$PRODUCTION" = "1" ]; then
    git config --global user.email "prismabots@gmail.com"
    git config --global user.name "Prismo"
    git remote add github "https://$GITHUB_ACTOR:$GH_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
else
    echo "Not setting up repo because PRODUCTION is not set"
fi

# Try to publish if $PAT (Personal Access Token - https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) exists 
if [ -z "$PAT" ]; then
    echo "\$PAT is empty. Please set the value of $PAT"
elif [ -n "$PAT" ]; then
    if [ "$PRODUCTION" = "1" ]; then
        echo "Publishing patch release"
        ./node_modules/.bin/vsce publish patch --pat "$PAT"
    else
        echo "Printing the command because PRODUCTION is not set"
        echo "./node_modules/.bin/vsce publish patch --pat $PAT"
    fi
fi

# Sync with remote branch (only master, see publish.yml) and push to it
if [ "$PRODUCTION" = "1" ]; then
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --ff-only
    git push github HEAD:"${GITHUB_REF}"
else
    echo "Not pushing because PRODUCTION is not set"
fi