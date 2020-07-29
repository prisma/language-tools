#!/bin/sh

set -eu

NPM_TAG="$1"

npm show "@prisma/cli@$NPM_TAG" version