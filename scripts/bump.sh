#!/bin/sh

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
    echo "Loading .envrc"
    # shellcheck disable=SC1091
    . .envrc
else
    echo "No .envrc"
fi


# Setup the repo with GITHUB_TOKEN to avoid running jobs when CI commits
if [ "$ENVIRONMENT" = "PRODUCTION" ]; then
    git config --global user.email "prismabots@gmail.com"
    git config --global user.name "Prismo"
    git remote add github "https://$GITHUB_ACTOR:$GITHUB_TOKEN@github.com/$GITHUB_REPOSITORY.git" || true
else
    echo "Not setting up repo because ENVIRONMENT is not set"
fi


RELEASE_CHANNEL=$1
echo "RELEASE_CHANNEL: $RELEASE_CHANNEL"

NEXT_EXTENSION_VERSION=$2
echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"

OLD_SHA=$(jq ".prisma.version" ./packages/vscode/package.json)
SHA=$(npx -q -p @prisma/cli@"$RELEASE_CHANNEL" prisma --version | grep "Query Engine" | awk '{print $5}')

NPM_VERSION=$(sh scripts/prisma-version.sh "$RELEASE_CHANNEL")
echo "NPM_VERSION: $NPM_VERSION"
echo "UPDATING to $NPM_VERSION"

if [ "$NEXT_EXTENSION_VERSION" = "" ]; then
    if [ "$RELEASE_CHANNEL" = 'patch-dev' ]; then 
        NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION" "true")
    else 
        # Release channel = dev on push to master 
        NPM_VERSION_STABLE=$(sh scripts/prisma-version.sh "latest")
        IS_MINOR_RELEASE=$(node scripts/is-minor-release.js "$NPM_VERSION_STABLE")
        NEXT_EXTENSION_VERSION=$(node scripts/extension-version.js "$NPM_VERSION" "$EXTENSION_VERSION" "false" "$NPM_VERSION_STABLE" "$IS_MINOR_RELEASE")
    fi
    
    echo "NEXT_EXTENSION_VERSION: $NEXT_EXTENSION_VERSION"
    echo "::set-output name=version::$NEXT_EXTENSION_VERSION"
fi

if [ "$RELEASE_CHANNEL" = "dev" ]; then
    echo "$NPM_VERSION" >scripts/prisma_version_insider
elif [ "$RELEASE_CHANNEL" = "latest" ]; then
    echo "$NPM_VERSION" >scripts/prisma_version_stable
else 
    echo "$NPM_VERSION" >scripts/prisma_version_patch_dev
fi

# If the RELEASE_CHANNEL is dev, we need to change the name, displayName, description and preview flag to the Insider extension
if [ "$RELEASE_CHANNEL" = "dev" ]; then
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma-insider\" | \
        .displayName = \"Prisma - Insider\" | \
        .description = \"This is the Insider Build of the Prisma VSCode extension (only use it if you are also using the dev version of the CLI.\" | \
        .dependencies[\"@prisma/language-server\"] = \"$NEXT_EXTENSION_VERSION\" | \
        .preview = true" \
    ./packages/vscode/package.json >./packages/vscode/package.json.bk
    node scripts/change-readme.js "$RELEASE_CHANNEL" "$NPM_VERSION"
else
    jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
        .name = \"prisma\" | \
        .displayName = \"Prisma\"| \
        .description = \"Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.\" | \
        .dependencies[\"@prisma/language-server\"] = \"$NEXT_EXTENSION_VERSION\" | \
        .preview = false" \
    ./packages/vscode/package.json >./packages/vscode/package.json.bk

    node scripts/change-readme.js "$RELEASE_CHANNEL" "$NPM_VERSION"
fi


jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
    .prisma.version = \"$SHA\" | \
    .dependencies[\"@prisma/get-platform\"] = \"$NPM_VERSION\"" \
./packages/language-server/package.json >./packages/language-server/package.json.bk

jq ".version = \"$NEXT_EXTENSION_VERSION\" | \
    .prisma.version = \"$SHA\"" \
./package.json > ./package.json.bk

mv ./packages/language-server/package.json.bk ./packages/language-server/package.json
mv ./packages/vscode/package.json.bk ./packages/vscode/package.json
mv ./package.json.bk ./package.json

(
    cd ./packages/language-server
    npm install
    npm run build
)

echo "Bumped prisma.version in package.json from $OLD_SHA to $SHA"
