{
  description = "An optional nix-based development setup";

  inputs = {
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    nixpkgs.url = "nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, flake-parts }:
    flake-parts.lib.mkFlake { inherit self; } {
      systems = [ "x86_64-linux" ];
      perSystem = { pkgs, system, self', ... }:
        {
          imports = [
            ./nix/format-project.nix
            ./nix/delete-node-modules.nix
            ./nix/shell.nix
            ./nix/vscode.nix
          ];
        };
    };
}
