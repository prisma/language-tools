{ pkgs, config, ... }:

let
  # We clean up the source for dream2nix to produce just the node_modules we
  # need to build and run the server.
  src = pkgs.runCommand "makesrc"
    { jq = pkgs.jq; root = ../packages/language-server; }
    ''
      export PATH="$jq/bin:$PATH"

      mkdir $out
      cp -r $root/src $out/src
      cp $root/package-lock.json $out/package-lock.json
      jq 'del(.scripts) | del(.bin) | del(.devDependencies.typescript) | del(.devDependencies.mocha)' $root/package.json > $out/package.json
      jq 'del(.extends) | del(.exclude)' $root/tsconfig.json > $out/tsconfig.json
    '';

  inherit (pkgs) nodejs typescript;
in
{
  dream2nix.inputs.language-server.source = src;

  packages.prisma-language-server =
    let nodeDeps = config.dream2nix.outputs.language-server.packages."@prisma/language-server"; in
    pkgs.stdenv.mkDerivation
      {
        name = "prisma-language-server";
        src = "${nodeDeps}/lib/node_modules/@prisma/language-server";

        buildInputs = [ nodejs typescript ];
        buildPhase = ''
          tsc --outDir $out/lib/dist
          cp -r node_modules $out/lib
          cp package.json $out/lib
        '';

        installPhase = ''
          mkdir $out/bin
          echo '#!/bin/bash' >> $out/bin/prisma-language-server
          echo "${nodejs}/bin/node $out/lib/dist/src/bin.js" >> $out/bin/prisma-language-server
          chmod +x $out/bin/prisma-language-server
        '';
      };
}
