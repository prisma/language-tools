#!/bin/sh

USE_LOCAL=${1-false}

# Build extension with esbuild and compile tests with tsc
echo "Building extension and compiling tests..."
cd packages/vscode || exit 1
pnpm build:dev
pnpm tsc -p tsconfig.test.json
cd ../..

CODE_TESTS_PATH="$(pwd)/packages/vscode/dist-tests/__test__"
export CODE_TESTS_PATH

CODE_TESTS_WORKSPACE="$(pwd)/packages/vscode/fixtures"
export CODE_TESTS_WORKSPACE

if [ "$USE_LOCAL" = "useLocalLS" ]; then 
    echo "Using local Language Server."
    node "$(pwd)/packages/vscode/dist-tests/__test__/runTest" "true"
else 
    echo "Using published Language Server."
    node "$(pwd)/packages/vscode/dist-tests/__test__/runTest" "false"
fi
