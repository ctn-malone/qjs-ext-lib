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
        highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";
        qel = import (./qel.nix) {
          pkgs = pkgs;
          pkgs-gum = pkgs-gum;
          qjsExtLib = qjsExtLib.packages.${system}.qjs-ext-lib;
        };
      in {
        packages = qel.packages;
        defaultPackage = qel.defaultPackage;
        apps = qel.apps;

        devShell = pkgs.mkShell {
          name = qel.package.name;

          buildInputs = [ qjsExtLib.packages.${system}.qjs-ext-lib ]
            ++ qel.allRuntimeDeps;

          shellHook = ''
            if [ -d src ]
            then
              dir="$(pwd)"
              cd src && qel-symlink.sh --quiet
              cd "$dir"
            fi
            echo -e "To compile a script, use ${
              highlight "qjsc.sh -o <binary> <source>"
            } (ex: ${
              highlight "qjsc.sh -o /tmp/my-script ./src/my-script.js"
            })" 1>&2
            echo -e "To run a script, use ${
              highlight "qjs.sh <source>"
            } (ex: ${highlight "qjs.sh ./src/my-script.js"}) or ${
              highlight "<source>"
            } (ex: ${highlight "./src/my-script.js"})" 1>&2
            echo -e "To add a script, use ${highlight "qel-bootstrap.sh"}" 1>&2
            echo -e "To upgrade the ${highlight "qjs-ext-lib"} version, use ${
              highlight "qel-upgrade.sh"
            }" 1>&2
          '';
        };
      });
}
