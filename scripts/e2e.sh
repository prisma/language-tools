#!/bin/sh

USE_LOCAL=${1-false}

CODE_TESTS_PATH="$(pwd)/packages/vscode/dist/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/packages/vscode/testFixture"
export CODE_TESTS_WORKSPACE

if [ "$USE_LOCAL" = "useLocalLSP" ]; then 
    echo "Using local LSP."
    node "$(pwd)/packages/vscode/dist/test/runTest" "true"
else 
    echo "Using published LSP."
    node "$(pwd)/packages/vscode/dist/test/runTest" "false"
fi
