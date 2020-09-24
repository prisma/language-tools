#!/bin/sh

set -eu

EXTENSION_TYPE=$1
echo "EXTENSION_TYPE: $EXTENSION_TYPE"

OS=$2
echo "OS: $OS"

VERSION_TO_TEST=$3
echo "VERSION_TO_TEST: $VERSION_TO_TEST"

if [ "$EXTENSION_TYPE" = "insider" ]; then
    EXTENSION_FOLDER_NAME="prisma.prisma-insider-$VERSION_TO_TEST"
else 
    EXTENSION_FOLDER_NAME="prisma.prisma-$VERSION_TO_TEST"
fi

echo "EXTENSION_FOLDER_NAME: $EXTENSION_FOLDER_NAME"

EXTENSION_INSTALL_PATH="$HOME/.vscode/extensions/$EXTENSION_FOLDER_NAME"

echo "Path to installed extension $EXTENSION_INSTALL_PATH"

echo "Installing dependencies inside the extension folder.."
WORKING_DIRECTORY=$PWD
cd "$EXTENSION_INSTALL_PATH" &&  npm install && cd "$WORKING_DIRECTORY"
echo "Finished installing dependencies."


CODE_TESTS_PATH="$EXTENSION_INSTALL_PATH/dist/src/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$EXTENSION_INSTALL_PATH/testFixture"
export CODE_TESTS_WORKSPACE

echo "Starting e2e tests."
node "$EXTENSION_INSTALL_PATH/dist/src/test/runTest" "false"
echo "Completed e2e tests."