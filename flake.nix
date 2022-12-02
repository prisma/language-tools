{
  description = "An optional nix-based development setup";

  inputs = {
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    nixpkgs.url = "nixpkgs/nixos-unstable";
    dream2nix = {
      url = "github:nix-community/dream2nix";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-parts.follows = "flake-parts";

        # Avoid fetching large unused projects.
        all-cabal-json.follows = "nixpkgs";
        nix-pypi-fetcher.follows = "nixpkgs";
      };
    };
  };

  outputs = { self, nixpkgs, flake-parts, dream2nix }:
    flake-parts.lib.mkFlake { inherit self; } {
      systems = [ "x86_64-linux" ];
      imports = [ dream2nix.flakeModuleBeta ];
      perSystem = { ... }:
        {
          imports = [
            ./nix/delete-node-modules.nix
            ./nix/format-project.nix
            ./nix/prisma-language-server.nix
            ./nix/shell.nix
            ./nix/vscode.nix
          ];
        };
    };
}
