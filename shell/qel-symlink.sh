#!/usr/bin/env bash

###
#
# Create a symlink to the library. It is not needed for execution nor compilation.
# Running it will allow completion and type checking (JSDoc) in your IDE
# by using `import {...} from './ext/...'``
#
# This script is supposed to be called when it has been installed in the nix store
# It should be called from another `flake.nix` file, to initialize a dev shell
#
###

script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)" || {
  echo "Script directory is unknown" >&2
  exit 2
}

symlink_dir="ext"
target_dir="${script_dir}/ext"

# ensure target directory exists
if ! [ -d "${target_dir}" ]; then
  echo "The target directory '${target_dir}' does not exist" 1>&2
  exit 1
fi

# check whether or not symlink already exists
if [ -d "${symlink_dir}" ] && ! [ -L "${symlink_dir}" ]; then
  echo "The directory 'ext' already exists and is not a symlink" 1>&2
  exit 1
fi

# create symlink
rm -f "${symlink_dir}" && ln -s "${script_dir}/ext" || exit $?

echo "Symlink successfully created" 1>&2
