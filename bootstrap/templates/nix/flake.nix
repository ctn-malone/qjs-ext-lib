{
  description = "@flake_description@";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    qjsExtLib.url = "github:ctn-malone/qjs-ext-lib";
    # pin gum to version 0.12
    nixpkgs-gum.url =
      "github:nixos/nixpkgs/5112417739f9b198047bedc352cebb41aa339e1d";
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
