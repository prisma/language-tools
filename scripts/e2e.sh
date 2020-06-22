#!/usr/bin/env bash

CODE_TESTS_PATH="$(pwd)/client/out/test"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/client/testFixture"
export CODE_TESTS_WORKSPACE

node "$(pwd)/client/out/test/runTest"