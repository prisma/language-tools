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

CHANNEL=$1
echo "CHANNEL: $CHANNEL"

PRISMA_VERSION=$2
echo "PRISMA_VERSION: $PRISMA_VERSION"

NEXT_EXTENSION_VERSION=$3
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

# Try to publish if $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN (Personal Access Token - https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) exists 
if [ -z "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    echo "\$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN is empty. Please set the value of $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
elif [ -n "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    if [ "$PRODUCTION" = "1" ]; then
        echo "Publishing $CHANNEL release"
        ./node_modules/.bin/vsce publish "$NEXT_EXTENSION_VERSION" --pat "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
    else
        echo "Printing the command because PRODUCTION is not set"
        echo "sh ./scripts/bump.sh" # The actual execution of this command is in check-update.sh becuase git working tree must be clean before calling `vsce publish`
        echo "./node_modules/.bin/vsce publish \"$NEXT_EXTENSION_VERSION\" --pat $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
    fi
fi

if [ "$PRODUCTION" = "1" ] && [ "$CHANNEL" = "dev" ]; then
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --ff-only
    git push github HEAD:"${GITHUB_REF}"
elif [ "$PRODUCTION" = "1" ] && [ "$CHANNEL" = "latest" ]; then
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --ff-only

    # In the stable channel, we just need to commit the prisma_version_stable file
    # to be able to track the Prisma version against which the current stable channel extension was published
    git reset origin/master
    git add ./scripts/prisma_version_stable
    git commit -m "bump prisma_version to $PRISMA_VERSION"

    git push github HEAD:"${GITHUB_REF}"
else 
    echo "Not pushing because PRODUCTION is not set"
fi
