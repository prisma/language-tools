{
  description = "An optional nix-based development setup";

  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      {
        apps = {
          # Build the vscode extension with pinned dependencies and the local
          # language server build. It will not package the vscode extension
          # into a .vsix you can install directly, because this is proving
          # extremely challenging to do locally.
          buildVscodeExtension = pkgs.writeShellScriptBin "buildVscodeExtension" ''
            PATH=${pkgs.nodejs}/bin:${pkgs.jq}/bin:$PATH

            set -euo pipefail

            echo -n 'npm --version: '
            npm --version
            echo -n 'node --version: '
            node --version

            echo 'Deleting node modules...'
            nix run .#deleteNodeModules

            echo 'Building language-server...'
            pushd ./packages/language-server
            npm install
            npm run build
            npm prune --production
            popd

            echo 'Building VSCode extension...'
            pushd ./packages/vscode
            npm install
            npm run build
            popd

            echo 'ok'
          '';
          # Start a VSCode instance with completely default configuration.
          # Follow the instructions from CONTRIBUTING.md to manually start
          # another instance of VSCode with the local build of the extension
          # (unpackaged) locally.
          code = pkgs.writeShellScriptBin "code" ''
            TMPDIR=`mktemp -d`
            USER_DIR=$TMPDIR/user_dir
            EXTENSIONS_DIR=$TMPDIR/extensions_dir
            CODE="${pkgs.vscodium}/bin/codium --user-data-dir $USER_DIR --extensions-dir=$EXTENSIONS_DIR"

            mkdir $USER_DIR $EXTENSIONS_DIR

            $CODE . --goto ./packages/vscode/src/test/testDb.prisma:10
          '';
          deleteNodeModules = pkgs.writeShellScriptBin "deleteNodeModules" ''
            find . -name 'node_modules' -prune
            find . -name 'node_modules' -prune | xargs rm -rf
          '';
        };
      }
    );
}
