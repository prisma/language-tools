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
echo "ENVIRONMENT: $ENVIRONMENT"
echo "============================"

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

NPM_VERSION=$(sh scripts/prisma-version.sh "$RELEASE_CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"


NEXT_EXTENSION_VERSION=$2
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"


# Try to publish if $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN (Personal Access Token - https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) exists
if [ -z "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    echo "\$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN is empty. Please set the value of $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN"
elif [ -n "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" ]; then
    if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
        echo "Publishing $RELEASE_CHANNEL release"
        cd packages/vscode && ./node_modules/.bin/vsce publish "$NEXT_EXTENSION_VERSION" --pat "$AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN" && cd ../..
    else
        echo "Printing the command because ENVIRONMENT is not set"
        echo "sh ./scripts/bump.sh" # The actual execution of this command is in check-update.sh becuase git working tree must be clean before calling `vsce publish`
        echo "cd packages/vscode && ./node_modules/.bin/vsce publish \"$NEXT_EXTENSION_VERSION\" --pat $AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN && cd ../.."
    fi
fi

if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    git add -A .
    git commit -m "bump prisma_version to $NPM_VERSION"
else
    echo "Not committing because ENVIRONMENT is not set"
fi

if [ "$ENVIRONMENT" = "PRODUCTION" ] && [ "$RELEASE_CHANNEL" = "dev" ]; then
    # Do not push readme for marketplace
    git reset -- packages/vscode/README.md
    
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --rebase
    git tag -a "insider/$NEXT_EXTENSION_VERSION" -m "insider/$NEXT_EXTENSION_VERSION" -m "Prisma version: $NPM_VERSION"
    git push github HEAD:"${GITHUB_REF}" --follow-tags
elif [ "$ENVIRONMENT" = "PRODUCTION" ] && [ "$RELEASE_CHANNEL" = "latest" ]; then
    echo "Sync with ${GITHUB_REF} and push to it"
    git pull github "${GITHUB_REF}" --rebase

    # In the stable channel, we just need to commit the prisma_version_stable file
    # to be able to track the Prisma version against which the current stable channel extension was published
    git reset origin/master
    git add ./scripts/prisma_version_stable
    git commit -m "bump prisma_version to $NPM_VERSION"
    git tag -a "$NEXT_EXTENSION_VERSION" -m "$NEXT_EXTENSION_VERSION" -m "Prisma version: $NPM_VERSION"
    git push github HEAD:"${GITHUB_REF}" --follow-tags
    # TODO: Create a release linked to this tag for stable
elif [ "$ENVIRONMENT" = "PRODUCTION" ] && [ "$RELEASE_CHANNEL" = "patch-dev" ]; then
    git add ./scripts/prisma_version_patch_dev
    git add ./scripts/extension_version_patch_dev
    git commit -m "patch prisma_version to $NPM_VERSION"
    git tag -a "$NEXT_EXTENSION_VERSION" -m "$NEXT_EXTENSION_VERSION" -m "Prisma version: $NPM_VERSION"

    PATCH_BRANCH=$(node scripts/patch/patch-branch.js "$NPM_VERSION")
    echo "PATCH_BRANCH: $PATCH_BRANCH"

    git push -u origin "$PATCH_BRANCH" --follow-tags
else
    echo "Not pushing because ENVIRONMENT is not set"
fi
