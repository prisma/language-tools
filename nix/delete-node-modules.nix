{ pkgs, ... }:

{
  packages.deleteNodeModules = pkgs.writeShellScriptBin "deleteNodeModules" ''
    find . -name 'node_modules' -prune
    find . -name 'node_modules' -prune | xargs rm -rf
  '';
}
