{ pkgs, qjsExtLib }:

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
      options = globalOptions
        // (lib.attrsets.attrByPath [ "options" ] { } script);
      runtimeDeps = globalRuntimeDeps
        ++ (lib.attrsets.attrByPath [ "runtimeDeps" ] [ ] script);
    })
    (lib.attrsets.attrByPath [ "scripts" ] [ ] config);

  defaultScript =
    if (lib.length scripts > 0) then
      (lib.findFirst
        (script: script.default)
        (builtins.head scripts)
        scripts)
    else
      null;

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
      if ! [ -L "ext" ] || ! [ -d "ext" ]
      then
        rm -f ext && ln -s ${qjsExtLib}/bin/ext
      fi
    '' + lib.strings.concatStringsSep "\n" (map
      (script: ''
        QJS_UPX=${
          if script.options.compress then "1" else "0"
        } qjsc.sh -o bin/${script.name} ${script.file}
      '')
      scripts);

    installPhase = ''
      mkdir -p $out/bin && cp -r bin $out
    '';

    # wrap binaries to make runtime deps available
    postFixup = lib.strings.concatStringsSep "\n" (map
      (script:
        let
          deps = map (pkgName: pkgs.${pkgName}) script.runtimeDeps;
          wrapCmd = ''
            wrapProgram $out/bin/${script.name} \
              --prefix PATH : ${lib.makeBinPath deps}
          '';
        in
        if (script.options.wrap && lib.length deps > 0) then wrapCmd else "")
      scripts);
  };

  packages = { "${package.name}" = package; };

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

  allRuntimeDeps = map (pkgName: pkgs.${pkgName}) (lib.lists.unique
    (lib.lists.flatten
      (lib.lists.concatMap (script: script.runtimeDeps) scripts)));
}
