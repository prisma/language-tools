{ pkgs, self', ... }:

{
  devShells.default = pkgs.mkShell {
    packages = [
      pkgs.nodejs
      pkgs.typescript
      self'.packages.buildVscodeExtension
      self'.packages.code
      self'.packages.deleteNodeModules
      self'.packages.formatProject
    ];
  };
}
