#!/bin/bash

set -e

# Step 1: Package the extension
echo "📦 Packaging the extension..."
vsce package

# Find the latest .vsix file
VSIX_FILE=$(ls -t *.vsix | head -n 1)

# Step 2: Install it into main VS Code instance
echo "🛠 Installing $VSIX_FILE into VS Code..."
code --install-extension "$VSIX_FILE"

echo "✅ Extension installed. You can now test it with GitHub Copilot enabled."