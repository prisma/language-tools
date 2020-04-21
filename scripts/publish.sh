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
echo "AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN: $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
echo "PRODUCTION: $PRODUCTION"
echo "============================"

PRISMA_VERSION=$(cat scripts/prisma_version)
echo "PRISMA_VERSION: $PRISMA_VERSION"

CHANNEL=$1
echo "CHANNEL: $CHANNEL"

# Try to publish if $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN (Personal Access Token - https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) exists 
if [ -z "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    echo "\$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN is empty. Please set the value of $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
elif [ -n "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    if [ "$PRODUCTION" = "1" ]; then
        echo "Publishing $CHANNEL release"
        ./node_modules/.bin/vsce publish "$PRISMA_VERSION" --pat "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
    else
        echo "Printing the command because PRODUCTION is not set"
        echo "sh ./scripts/bump-sha.sh" # The actual execution of this command is in check-update.sh becuase git working tree must be clean before calling `vsce publish`
        echo "./node_modules/.bin/vsce publish \"$PRISMA_VERSION\" --pat $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
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