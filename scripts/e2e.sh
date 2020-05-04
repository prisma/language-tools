#!/bin/sh

CODE_TESTS_PATH="$(pwd)/clients/vscode/out/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/clients/vscode/testFixture"
export CODE_TESTS_WORKSPACE

node "$(pwd)/clients/vscode/out/test/runTest"