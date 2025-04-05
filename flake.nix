{
  description = "QuickJS Extensions Library";

  inputs = {
    nixpkgs = { url = "github:nixos/nixpkgs/nixos-unstable"; };

    quickjs-static.url =
      "github:ctn-malone/quickjs-cross-compiler?rev=d8010afb61ef9c7d53c0bd26e65af83b83ce5e48";
    flake-utils.url = "github:numtide/flake-utils";
    # pin gum to version 0.12
    nixpkgs-gum.url =
      "github:nixos/nixpkgs/5112417739f9b198047bedc352cebb41aa339e1d";
  };

  outputs = { self, nixpkgs, quickjs-static, flake-utils, nixpkgs-gum }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "armv7l-linux" "aarch64-linux" ]
    (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        pkgs-gum = nixpkgs-gum.legacyPackages.${system};

        highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";

        bootstrap = pkgs.writeShellApplication {
          name = "qel-bootstrap.sh";
          runtimeInputs = [ pkgs-gum.gum ];
          text = ''
            script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
            bootstrap_dir="$(realpath "$script_dir/../bootstrap")"
            QEL_TEMPLATES_ROOT_DIR="$bootstrap_dir/templates" \
              QEL_EXT_DIR="$script_dir/ext" "$script_dir"/qjs.sh "$bootstrap_dir/bootstrap.js" "$@"
          '';
        };
      in {

        packages.qjs-ext-lib = pkgs.stdenv.mkDerivation {
          name = "qjs-ext-lib";

          src = ./.;

          configurePhase = false;
          buildPhase = false;
          installPhase = ''
            mkdir -p $out/bin/ext
            cp -R $src/src/* $out/bin/ext

            cp -R ${
              quickjs-static.packages.${system}.quickjs-static
            }/bin/* $out/bin

            # rewrite ext symlink in bootstrap
            mkdir -p bootstrap
            cp -R $src/bootstrap/* bootstrap
            rm -f bootstrap/ext
            ln -s ../bin/ext bootstrap/ext
            mkdir -p $out/bootstrap
            cp -R bootstrap $out

            cp $src/shell/qel-*.sh $out/bin
            cp -R ${bootstrap}/bin/qel-bootstrap.sh $out/bin
          '';
        };

        defaultPackage = self.packages.${system}.qjs-ext-lib;

        apps = {
          # interpreter
          default = {
            type = "app";
            program = "${self.packages.${system}.qjs-ext-lib}/bin/qjs.sh";
          };

          qjs = self.apps.${system}.default;

          # compiler
          qjsc = {
            type = "app";
            program = "${self.packages.${system}.qjs-ext-lib}/bin/qjsc.sh";
          };

          # initialize a new repository
          bootstrap = {
            type = "app";
            program =
              "${self.packages.${system}.qjs-ext-lib}/bin/qel-bootstrap.sh";
          };
        };

        # dev shell with extra runtime dependencies
        devShell = pkgs.mkShell {
          name = "qjs-ext-lib";

          buildInputs = [
            # to compress compiled binaries
            pkgs.upx
            pkgs.curl
            # to build interactive CLIs
            pkgs-gum.gum
            self.packages.${system}.qjs-ext-lib
          ];

          shellHook = ''
            echo -e "To compile a JS file, use ${
              highlight "qjsc.sh -o <binary> <source>"
            } (ex: ${highlight "qjsc.sh -o /tmp/example example.js"})" 1>&2
            echo -e "To run a JS file, use ${
              highlight "qjs.sh <source>"
            } (ex: ${highlight "qjs.sh example.js"})" 1>&2
            echo -e "To create a symlink to the lib directory (and improve completion/typing in your IDE), use ${
              highlight "qel-symlink.sh"
            }" 1>&2
            echo -e "To bootstrap a new project, use ${
              highlight "qel-bootstrap.sh"
            }" 1>&2
          '';
        };
      });
}
