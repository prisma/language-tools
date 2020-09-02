#!/bin/sh

set -eu

PATCH_TAG=$(cat scripts/versions/extension_patch)
echo "PATCHTAG: $PATCH_TAG"

echo "::set-output name=tag::$PATCH_TAG"
