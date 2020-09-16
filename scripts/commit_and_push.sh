#!/bin/sh
# shellcheck disable=SC2086

set -eu

# For local development, in production, the environment will be set though GH actions and GH secrets
if [ -f ".envrc" ]; then
  echo "Loading .envrc"
  # shellcheck disable=SC1091
  . .envrc
else
  echo "No .envrc"
fi

COMMIT_MESSAGE=$1
echo "COMMIT_MESSAGE: $COMMIT_MESSAGE"

BRANCH=${2-master}
echo "BRANCH: $BRANCH"

NEW_BRANCH=${3-false}
echo "NEW BRANCH: $NEW_BRANCH"

git add -A .
git commit -am "$COMMIT_MESSAGE"

if [ "$NEW_BRANCH" = "false" ]; then 
  git pull --rebase
  if [ $BRANCH = "master" ]; then
    git push
  else
    git push $BRANCH
  fi
else 
  ## Do not rebase on newly created branch
  git push --set-upstream origin $BRANCH
fi