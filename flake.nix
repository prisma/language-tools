{
  description = "Development environment for prisma-language-tools";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        defaultPackage = pkgs.cowsay;

        devShell = pkgs.mkShell {
          shellHook = ''
            alias code=${pkgs.vscodium}/bin/codium
          '';
        };
      });

}
