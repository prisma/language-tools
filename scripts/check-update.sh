CURRENT_VERSION=$(cat scripts/prisma_version)
echo "CURRENT_VERSION: $CURRENT_VERSION"

NPM_VERSION=$(sh scripts/prisma-version.sh "latest")
echo "NPM_VERSION: $NPM_VERSION"

if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
    echo "UPDATING to $NPM_VERSION"
    echo $NPM_VERSION > scripts/prisma_version
    yarn run vsce:publish
else
    echo "CURRENT_VERSION ($CURRENT_VERSION) and NPM_VERSION ($NPM_VERSION) are same"
fi