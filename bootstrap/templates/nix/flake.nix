{
  description = "@flake_description@";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    qjsExtLib.url = "github:ctn-malone/qjs-ext-lib";
  };

  outputs = { self, nixpkgs, flake-utils, qjsExtLib }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "armv7l-linux" "aarch64-linux" ]
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";
          qel = import (./qel.nix) {
            pkgs = pkgs;
            qjsExtLib = qjsExtLib.packages.${system}.qjs-ext-lib;
          };
        in
        {
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
              echo -e "To compile a JS file, use ${
                highlight "qjsc.sh -o <binary> <source>"
              }" 1>&2
              echo -e "To run a JS file, use ${highlight "qjs.sh <source>"}" 1>&2
              echo -e "To add a script, use ${highlight "qel-bootstrap.sh"}" 1>&2
              echo -e "To upgrade the ${highlight "qjs-ext-lib"} version, use ${highlight "qel-upgrade.sh"}" 1>&2
            '';
          };
        });
}
