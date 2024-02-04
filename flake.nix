{
  description = "QuickJS Extensions Library";

  inputs = {
    nixpkgs = {
      url = "github:nixos/nixpkgs/nixos-unstable";
    };

    quickjs-static.url = "github:ctn-malone/quickjs-cross-compiler?rev=5f6239ff669c0992d7db2d9f3781f25ac5bf2c14";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, quickjs-static, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "armv7l-linux" "aarch64-linux" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";
      in
      {

        packages.qjs-ext-lib = pkgs.stdenv.mkDerivation {
          name = "qjs-ext-lib";

          src = ./.;

          configurePhase = false;
          buildPhase = false;
          installPhase = ''
            mkdir -p $out/bin/ext
            cp -R $src/src/* $out/bin/ext
            cp $src/shell/qel-*.sh $out/bin
            cp -R ${quickjs-static.packages.${system}.quickjs-static}/bin/* $out/bin
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
        };

        # dev shell with extra runtime dependencies
        devShell = pkgs.mkShell {
          name = "qjs-ext-lib";

          buildInputs = [
            # to compress compiled binaries
            pkgs.upx
            pkgs.curl
            # to build interactive CLIs
            pkgs.gum
            self.packages.${system}.qjs-ext-lib
          ];

          shellHook = ''
            echo -e "To compile a JS file, use ${highlight "qjsc.sh -o <binary> <source>"}" 1>&2
            echo -e "To run a JS file, use ${highlight "qjs.sh <source>"}" 1>&2
            echo -e "To create a symlink to the lib directory (and improve completion/typing in your IDE), use ${highlight "qel-symlink.sh"}" 1>&2
          '';
        };
      }
    );
}
