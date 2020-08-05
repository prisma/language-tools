#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . ./.envrc
else
    echo "No .envrc"
fi

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    CURRENT_VERSION=$(cat scripts/prisma_version_insider)
elif [ "$RELEASE_CHANNEL" = "latest" ]; then
    CURRENT_VERSION=$(cat scripts/prisma_version_stable)
else 
    CURRENT_VERSION=$(cat scripts/prisma_version_patch_dev)
fi

echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "$RELEASE_CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"


if [ "$RELEASE_CHANNEL" = "dev" ]; then
    if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then   
        EXTENSION_VERSION=$(sh scripts/extension-version.sh "$RELEASE_CHANNEL" "toBeCreated")
        echo "EXTENSION_VERSION: $EXTENSION_VERSION"

        NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION")
        echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"
        echo "::set-output name=version::$NEXT_EXTENSION_VERSION"
    else 
        echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
    fi
elif [ "$RELEASE_CHANNEL" = "latest" ]; then 
    IS_MINOR_RELEASE=$(node scripts/is-minor-release.js "$NPM_VERSION")
    if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then   
        echo "IS_MINOR_RELEASE: $IS_MINOR_RELEASE"
        if [ "$IS_MINOR_RELEASE" = true ]; then
            echo "NEXT_EXTENSION_VERSION: $NPM_VERSION"
            echo "::set-output name=is-minor-release::true"
            echo "::set-output name=version::$NPM_VERSION"
        else
            echo "Not a minor release of Prisma CLI."
        fi
    else 
        echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
    fi  
else 
    # check for new patch-dev Prisma CLI version
    if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then 
        LAST_PATCH_EXTENSION_VERSION=$(cat scripts/extension_version_patch_dev)
        echo "LAST_PATCH_EXTENSION_VERSION: $LAST_PATCH_EXTENSION_VERSION"
        NPM_VERSION_STABLE=$(sh scripts/prisma-version.sh "latest")
        echo "NPM_VERSION_STABLE: $NPM_VERSION_STABLE"

        NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION_STABLE" "$LAST_PATCH_EXTENSION_VERSION" "true")
        echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"
        echo "::set-output name=patch-version::$NEXT_EXTENSION_VERSION"
    else 
        echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same" 
    fi
fi
