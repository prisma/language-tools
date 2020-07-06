#!/bin/sh

set -eu

OS=$1
echo "OS: $OS"

EXTENSION_TYPE=$2
echo "EXTENSION_TYPE: $EXTENSION_TYPE"

if [ "$EXTENSION_TYPE" = "insider" ]; then
    EXTENSION_VERSION=$(sh scripts/extension-version.sh "dev" "")
    echo "EXTENSION_VERSION: $EXTENSION_VERSION"
    EXTENSION_FOLDER_NAME="prisma.prisma-insider-$EXTENSION_VERSION"
else 
    EXTENSION_VERSION=$(sh scripts/extension-version.sh "latest" "")
    echo "EXTENSION_VERSION: $EXTENSION_VERSION"
    EXTENSION_FOLDER_NAME="prisma.prisma-$EXTENSION_VERSION"
fi

echo "EXTENSION_FOLDER_NAME: $EXTENSION_FOLDER_NAME"

if [ "$OS" = "windows-latest" ]; then
    PATH="%USERPROFILE%\.vscode\extensions\\$EXTENSION_FOLDER_NAME"
else
    PATH="~/.vscode/extensions/$EXTENSION_FOLDER_NAME"
fi
echo "Path to installed extension $PATH"

CODE_TESTS_PATH="$PATH/dist/src/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$PATH/testFixture"
export CODE_TESTS_WORKSPACE

node "$PATH/dist/src/test/runTest"