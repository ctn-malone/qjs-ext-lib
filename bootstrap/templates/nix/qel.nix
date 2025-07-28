{ pkgs, qjsExtLib, pkgs-gum }:

let
  lib = pkgs.lib;
  config = lib.importJSON ./qel.config.json;

  baseNameWithoutExtOf = path:
    let
      list = lib.strings.splitString "." (builtins.baseNameOf path);
      sublist = lib.lists.sublist 0 ((lib.length list) - 1) list;
    in
    lib.strings.concatStringsSep "." sublist;

  defaultGlobalOptions = {
    compress = false;
    wrap = true;
  };

  globalOptions = defaultGlobalOptions
    // lib.attrsets.attrByPath [ "options" ] { } config;
  globalRuntimeDeps = lib.attrsets.attrByPath [ "runtimeDeps" ] [ ] config;

  packageName = lib.attrsets.attrByPath [ "packageName" ] "qel-scripts" config;

  # ensure each script attrSet has every attribute defined
  scripts = map
    (script: {
      file = script.file;
      name = lib.attrsets.attrByPath [ "name" ] (baseNameWithoutExtOf script.file)
        script;
      default = if (script ? "default") then script.default else false;
      completion = if (script ? "completion") then script.completion else false;
      options = globalOptions
        // (lib.attrsets.attrByPath [ "options" ] { } script);
      runtimeDeps = globalRuntimeDeps
        ++ (lib.attrsets.attrByPath [ "runtimeDeps" ] [ ] script);
    })
    (lib.attrsets.attrByPath [ "scripts" ] [ ] config);

  scriptsWithCompletion = builtins.filter (script: script.completion) scripts;

  defaultScript =
    if (lib.length scripts > 0) then
      (lib.findFirst
        (script: script.default)
        (builtins.head scripts)
        scripts)
    else
      null;

  highlight = text: "\\x1b[1;38;5;212m${text}\\x1b[0m";

in
with pkgs; rec {
  package = stdenv.mkDerivation {
    name = packageName;

    src = ./src;

    nativeBuildInputs = [ qjsExtLib upx makeWrapper ];

    configurePhase = false;

    # compile each script
    buildPhase = ''
      mkdir bin
      if ! [ -L "ext" ] || ! [ -d "ext" ] ; then
        rm -f ext && ln -s ${qjsExtLib}/bin/ext
      fi
      bash_completion="$(${qjsExtLib}/bin/qel-completion.sh -s bash -c ${./qel.config.json})"
      if [ -n "$bash_completion" ] ; then
        mkdir -p share/bash-completion/completions
      fi
      zsh_completion="$(${qjsExtLib}/bin/qel-completion.sh -s zsh -c ${./qel.config.json})"
      if [ -n "$zsh_completion" ] ; then
        mkdir -p share/zsh/site-functions
        echo "$zsh_completion" >share/zsh/site-functions/_${packageName}
      fi
    '' + lib.strings.concatStringsSep "\n" (map
      (script: ''
        QJS_UPX=${
          if script.options.compress then "1" else "0"
        } qjsc.sh -o bin/${script.name} ${script.file}
      '')
      scripts) + lib.strings.concatStringsSep "\n" (map
      (script: ''
        echo "$bash_completion" >share/bash-completion/completions/${script.name}
      '')
      scriptsWithCompletion);

    installPhase = ''
      mkdir -p $out/bin && cp -r bin $out
      if [ -d share ]; then
        mkdir -p $out/share && cp -r share $out
      fi
    '';

    # wrap binaries to make runtime deps available
    postFixup = lib.strings.concatStringsSep "\n" (map
      (script:
        let
          deps = map (pkgName: (if pkgName == "gum" then pkgs-gum.${pkgName} else pkgs.${pkgName})) script.runtimeDeps;
          wrapCmd = ''
            wrapProgram $out/bin/${script.name} \
              --prefix PATH : ${lib.makeBinPath deps}
          '';
        in
        if (script.options.wrap && lib.length deps > 0) then wrapCmd else "")
      scripts);
  };

  packages = { "${package.name}" = package; default = package; };

  defaultPackage = package;

  # expose each script as a separate app
  apps = builtins.listToAttrs
    (map
      (script: {
        name = script.name;
        value = {
          type = "app";
          program = "${package}/bin/${script.name}";
        };
      })
      scripts) // (if defaultScript != null then {
    default = {
      type = "app";
      program = "${package}/bin/${defaultScript.name}";
    };
  } else
    { });

  shellHook = ''
    if [ -d src ] ; then
      dir="$(pwd)"
      cd src && qel-symlink.sh --quiet
      cd "$dir"
    fi
    eval "$(qel-completion.sh --dev --no-release)"
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
    echo -e "To generate shell completion, use ${highlight "qel-completion.sh"}" 1>&2
    echo -e "To upgrade the ${highlight "qjs-ext-lib"} version, use ${
      highlight "qel-upgrade.sh"
    }" 1>&2
  '';

  allRuntimeDeps = map (pkgName: pkgs.${pkgName}) (lib.lists.unique
    (lib.lists.flatten
      (lib.lists.concatMap (script: script.runtimeDeps) scripts)));
}
