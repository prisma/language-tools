#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . ./.envrc
else
    echo "No .envrc"
fi

EXTENSION_VERSION=$(sh scripts/extension-version.sh "dev" "")
echo "EXTENSION_VERSION: $EXTENSION_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "dev")
echo "NPM_VERSION: $NPM_VERSION"

NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION" true)
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"


jq ".version = \"$NEXT_EXTENSION_VERSION\""| \
    ./package.json > ./package.json.bk

echo "::set-output name=version::$NEXT_EXTENSION_VERSION"

jq ".version = \"$NEXT_EXTENSION_VERSION\"" \
    ./server/package.json > ./server/package.json.bk

jq ".version = \"$NEXT_EXTENSION_VERSION\"" \
    ./client/package.json > ./client/package.json.bk

mv ./package.json.bk ./package.json
mv ./server/package.json.bk ./server/package.json
mv ./client/package.json.bk ./client/package.json

npm install

(
cd ./client
npm install
)

(
cd ./server
npm install
)


if [ "$PRODUCTION" = "1" ]; then
        git add -A .
else
        echo "Not committing because production is not set"
fi