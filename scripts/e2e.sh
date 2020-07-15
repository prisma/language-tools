#!/bin/sh

CODE_TESTS_PATH="$(pwd)/packages/vscode/dist/src/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/packages/vscode/testFixture"
export CODE_TESTS_WORKSPACE


node "$(pwd)/packages/vscode/dist/src/test/runTest" 