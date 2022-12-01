{ pkgs, self', ... }:

{
  devShells.default = pkgs.mkShell {
    packages = [
      pkgs.nodejs
      self'.packages.buildVscodeExtension
      self'.packages.code
      self'.packages.deleteNodeModules
      self'.packages.formatProject
    ];
  };
}
