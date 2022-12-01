{ pkgs, ... }:

{
  packages.formatProject = pkgs.writeShellScriptBin "formatProject" ''
    PATH=${pkgs.nodejs}/bin:${pkgs.jq}/bin:$PATH
    PRETTIER_VERSION=`jq -r .devDependencies.prettier ${./package.json}`
    npx prettier@$PRETTIER_VERSION -w ./packages/**/*.ts ./**/*.json ./**/*.js
  '';
}
