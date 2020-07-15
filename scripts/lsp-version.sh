#!/bin/sh

set -eu

VERSION=$1

REGISTRY_INFO=$(npm view @prisma/language-server@"$VERSION")

echo "$REGISTRY_INFO"

if [ "$REGISTRY_INFO" = "" ]; then
    echo "LSP not published yet."
    echo "::set-output name=lsp-not-published::true"
else
    echo "LSP with version $VERSION is published already."
fi
