#!/bin/sh

set -eu

RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

VSCODE_VERSION=$2
echo "VSCODE_VERSION: $VSCODE_VERSION"

if [ "$RELEASE_CHANNEL" = "latest" ]; then 
    echo "::set-output name=tag-name::$VSCODE_VERSION"
    echo "::set-output name=asset-name::prisma"
else
    echo "::set-output name=tag-name::insider/$VSCODE_VERSION"
    echo "::set-output name=asset-name::prisma-insider"
fi
