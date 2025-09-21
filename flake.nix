{
  description = "QuickJS Extensions Library";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    quickjs-static.url = "github:ctn-malone/quickjs-cross-compiler?rev=1066cf6aad9f10edfafc4e0302d7d951a327f437";
    nixpkgs-gum.url = "github:nixos/nixpkgs/5112417739f9b198047bedc352cebb41aa339e1d";
  };

  outputs = { self, nixpkgs, quickjs-static, nixpkgs-gum, ... }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "armv7l-linux" ];
      system = builtins.currentSystem or "x86_64-linux";

      # Check if the current system is supported
      assertSupported = builtins.elem system supportedSystems;

      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          (final: prev: {
            quickjsStatic = quickjs-static.packages.${system}.quickjs-static;
          })
        ];
      };

      pkgs-gum = import nixpkgs-gum { inherit system; };

      highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";

      bootstrapScript = pkgs.writeShellScriptBin "qel-bootstrap.sh" ''
        export PATH=${pkgs-gum.gum}/bin:$PATH
        script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
        bootstrap_dir="$(realpath "$script_dir/../bootstrap")"
        QEL_TEMPLATES_ROOT_DIR="$bootstrap_dir/templates" \
          QEL_EXT_DIR="$script_dir/ext" "$script_dir"/qjs.sh "$bootstrap_dir/bootstrap.js" "$@"
      '';

      generateCompletionScript = pkgs.writeShellScriptBin "qel-completion.sh" ''
        script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
        bootstrap_dir="$(realpath "$script_dir/../bootstrap")"
        QEL_TEMPLATES_ROOT_DIR="$bootstrap_dir/templates" \
          "$script_dir"/qjs.sh "$bootstrap_dir/generate-completion.js" "$@"
      '';

      qjsExtLib = pkgs.stdenv.mkDerivation {
        name = "qjs-ext-lib";
        src = pkgs.lib.cleanSource ./.;
        configurePhase = false;
        buildPhase = false;
        installPhase = ''
          mkdir -p $out/bin/ext
          cp -R $src/src/* $out/bin/ext
          cp -R ${pkgs.quickjsStatic}/bin/* $out/bin

          # rewrite ext symlink in bootstrap
          mkdir -p bootstrap
          cp -R $src/bootstrap/* bootstrap
          rm -f bootstrap/ext
          ln -s ../bin/ext bootstrap/ext
          mkdir -p $out/bootstrap
          cp -R bootstrap $out

          cp $src/shell/qel-*.sh $out/bin
          cp -R ${bootstrapScript}/bin/qel-bootstrap.sh $out/bin
          cp -R ${generateCompletionScript}/bin/qel-completion.sh $out/bin
        '';
      };
    in
    if assertSupported then {
      packages.${system} = {
        default = qjsExtLib;
        qjs-ext-lib = qjsExtLib;
      };

      apps.${system} = {
        default = {
          type = "app";
          program = "${qjsExtLib}/bin/qjs.sh";
        };

        qjs = self.apps.${system}.default;
        qjsc = {
          type = "app";
          program = "${qjsExtLib}/bin/qjsc.sh";
        };
        bootstrap = {
          type = "app";
          program = "${qjsExtLib}/bin/qel-bootstrap.sh";
        };
      };

      devShells.${system}.default = pkgs.mkShell {
        name = "qjs-ext-lib-dev";
        buildInputs = [ pkgs.upx pkgs.curl pkgs-gum.gum qjsExtLib ];
        shellHook = ''
          echo -e "To compile a JS file, use ${
            highlight "qjsc.sh -o <binary> <source>"
          }" 1>&2
          echo -e "To run a JS file, use ${
            highlight "qjs.sh <source>"
          }" 1>&2
          echo -e "To create a symlink to the lib directory, use ${
            highlight "qel-symlink.sh"
          }" 1>&2
          echo -e "To bootstrap a new project, use ${
            highlight "qel-bootstrap.sh"
          }" 1>&2
        '';
      };
    } else
      throw "Unsupported system: ${system}. Supported systems: ${builtins.concatStringsSep ", " supportedSystems}";
}
