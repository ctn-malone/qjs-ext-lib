{
  description = "@flake_description@";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    qjsExtLib.url = "github:ctn-malone/qjs-ext-lib";
    # pin gum to version 0.17.0
    nixpkgs-gum.url = "github:nixos/nixpkgs/554be6495561ff07b6c724047bdd7e0716aa7b46";
  };

  outputs = { self, nixpkgs, flake-utils, qjsExtLib, nixpkgs-gum }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "armv7l-linux" "aarch64-linux" ]
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pkgs-gum = nixpkgs-gum.legacyPackages.${system};
          qel = import (./qel.nix) {
            pkgs = pkgs;
            pkgs-gum = pkgs-gum;
            qjsExtLib = qjsExtLib.packages.${system}.qjs-ext-lib;
          };
        in
        {
          packages = qel.packages;
          apps = qel.apps;

          devShell = pkgs.mkShell {
            name = qel.package.name;

            buildInputs = [ qjsExtLib.packages.${system}.qjs-ext-lib ]
              ++ qel.allRuntimeDeps;

            shellHook = ''
              ${qel.shellHook}
            '';
          };
        });
}
