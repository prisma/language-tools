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
    EXTENSION_INSTALL_PATH="%USERPROFILE%\.vscode\extensions\\$EXTENSION_FOLDER_NAME"
else
    EXTENSION_INSTALL_PATH="$HOME/.vscode/extensions/$EXTENSION_FOLDER_NAME"
fi
echo "Path to installed extension $EXTENSION_INSTALL_PATH"

CODE_TESTS_PATH="$EXTENSION_INSTALL_PATH/dist/src/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$EXTENSION_INSTALL_PATH/testFixture"
export CODE_TESTS_WORKSPACE

node "$EXTENSION_INSTALL_PATH/dist/src/test/runTest"