{
  description = "QuickJs Extensions Library";

  inputs = {
    nixpkgs = {
      url = "github:nixos/nixpkgs?rev=057f9aecfb71c4437d2b27d3323df7f93c010b7e";
    };

    quickjs-static.url = "github:ctn-malone/quickjs-cross-compiler?rev=d2886aec4a26d15e17ffb2f8723a75ddccee0f65";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, quickjs-static, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "armv7l-linux" "aarch64-linux" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {

        packages.qjs-ext-lib = pkgs.stdenv.mkDerivation {
          name = "qjs-ext-lib";

          src = ./src;

          configurePhase = false;
          buildPhase = false;
          installPhase = ''
            mkdir -p $out/ext
            cp -R $src/* $out/ext
          '';
        };

        defaultPackage = self.packages.${system}.qjs-ext-lib;

        devShell = pkgs.mkShell {
          name = "qjs-ext-lib";

          buildInputs = [
            pkgs.upx
            pkgs.curl
            quickjs-static.packages.${system}.quickjs-static
            self.packages.${system}.qjs-ext-lib
          ];

          shellHook = ''
            export QJS_LIB_DIR=${self.packages.${system}.qjs-ext-lib}
            echo "To compile a JS file, use qjsc.sh -o <binary> <source>" 1>&2
            echo "To run a JS file, use qjs.sh <source>" 1>&2
          '';
        };
      }
    );
}
