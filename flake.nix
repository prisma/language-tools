{
  description = "An optional nix-based development setup";

  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      {
        apps = {
          # Build the vscode extension with pinned dependencies.
          buildVscodeExtension = pkgs.writeShellScriptBin "buildVscodeExtension" ''
            PATH=${pkgs.nodejs}/bin:${pkgs.jq}/bin:$PATH

            echo -n 'npm --version: '
            npm --version
            echo -n 'node --version: '
            node --version

            echo 'Building language-server...'
            pushd ./packages/language-server
            npm clean-install --no-save
            npm run build
            popd

            echo 'Building VSCode extension...'
            pushd ./packages/vscode

            TMP_PACKAGE_JSON=`jq '.dependencies."@prisma/language-server" = "../language-server"' package.json`
            echo $TMP_PACKAGE_JSON > package.json

            npm install
            npm run build
            npm run package -- --no-dependencies
            popd

            echo 'ok'
          '';
          # Start a VSCode instance with completely default configuration in a
          # temporary directory, but it has the local build of the extension
          # installed (see buildVscodeExtension above) and an example Prisma
          # schema.
          code = pkgs.writeShellScriptBin "code" ''
            TMPDIR=`mktemp -d`
            USER_DIR=$TMPDIR/user_dir
            DATA_DIR=$TMPDIR/data_dir
            EXTENSIONS_DIR=$TMPDIR/extensions_dir
            CODE="${pkgs.vscodium}/bin/codium --user-data-dir $USER_DIR --extensions-dir=$EXTENSIONS_DIR"
            EXTENSION_FILE=`find ./packages/vscode -name 'prisma-insider*.vsix' -print`

            if [[ $EXTENSION_FILE == "" ]]; then
              echo "Could not find extension file in packages/vscode"
              exit 1
            fi

            mkdir $USER_DIR $DATA_DIR $EXTENSIONS_DIR

            cp ${./packages/vscode/src/test/testDb.prisma} $DATA_DIR/schema.prisma
            chmod -R 777 $DATA_DIR

            $CODE --install-extension $EXTENSION_FILE
            $CODE $DATA_DIR --goto $DATA_DIR/schema.prisma:10
          '';
          deleteNodeModules = pkgs.writeShellScriptBin "deleteNodeModules" ''
            find . -name 'node_modules' -prune
            find . -name 'node_modules' -prune | xargs rm -rf
          '';
        };
      }
    );
}
