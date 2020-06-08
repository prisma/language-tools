#!/bin/sh

CODE_TESTS_PATH="$(pwd)/dist/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/testFixture"
export CODE_TESTS_WORKSPACE

node "$(pwd)/dist/test/runTest"