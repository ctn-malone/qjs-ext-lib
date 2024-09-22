###
#
# This script is supposed to be called when it has been installed in the nix store
# It should be called using `nix run github:ctn-malone/qjs-ext-lib#bootstrap`
#
###

script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)" || {
  echo "Script directory is unknown" >&2
  exit 2
}

# TODO: pass the location of templates
nix shell nixpkgs#gum --command "${script_dir}/qjs.sh" "${script_dir}/../bootstrap/bootstrap.js"
