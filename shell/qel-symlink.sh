#!/usr/bin/env bash
set -o pipefail

###
#
# Create a symlink to the library. It is not needed for execution nor compilation.
# Running it will allow completion and type checking (JSDoc) in your IDE
# by using `import {...} from './ext/...'``
#
# This script is supposed to be called when it has been installed in the nix store.
# Calling it directly won't work.
#
###

script_dir="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)" || {
  echo "Couldn't determine the script's running directory, which probably matters, bailing out" >&2
  exit 2
}

# Created by argbash-init v2.10.0
# ARG_OPTIONAL_BOOLEAN([force],[f],[Whether or not script should be recreated],[off])
# ARG_OPTIONAL_BOOLEAN([quiet],[q],[Don't output anything to stderr unless an error occurs],[off])
# ARG_HELP([<Create a symlink to the library>])
# ARGBASH_SET_INDENT([  ])
# ARGBASH_GO()
# needed because of Argbash --> m4_ignore([
### START OF CODE GENERATED BY Argbash v2.10.0 one line above ###
# Argbash is a bash code generator used to get arguments parsing right.
# Argbash is FREE SOFTWARE, see https://argbash.io for more info

die() {
  local _ret="${2:-1}"
  test "${_PRINT_HELP:-no}" = yes && print_help >&2
  echo "$1" >&2
  exit "${_ret}"
}

begins_with_short_option() {
  local first_option all_short_options='fqh'
  first_option="${1:0:1}"
  test "$all_short_options" = "${all_short_options/$first_option/}" && return 1 || return 0
}

# THE DEFAULTS INITIALIZATION - OPTIONALS
_arg_force="off"
_arg_quiet="off"

print_help() {
  printf '%s\n' "<Create a symlink to the library>"
  printf 'Usage: %s [-f|--(no-)force] [-q|--(no-)quiet] [-h|--help]\n' "$0"
  printf '\t%s\n' "-f, --force, --no-force: Whether or not script should be recreated (off by default)"
  printf '\t%s\n' "-q, --quiet, --no-quiet: Don't output anything to stderr unless an error occurs (off by default)"
  printf '\t%s\n' "-h, --help: Prints help"
}

parse_commandline() {
  while test $# -gt 0; do
    _key="$1"
    case "$_key" in
    -f | --no-force | --force)
      _arg_force="on"
      test "${1:0:5}" = "--no-" && _arg_force="off"
      ;;
    -f*)
      _arg_force="on"
      _next="${_key##-f}"
      if test -n "$_next" -a "$_next" != "$_key"; then
        { begins_with_short_option "$_next" && shift && set -- "-f" "-${_next}" "$@"; } || die "The short option '$_key' can't be decomposed to ${_key:0:2} and -${_key:2}, because ${_key:0:2} doesn't accept value and '-${_key:2:1}' doesn't correspond to a short option."
      fi
      ;;
    -q | --no-quiet | --quiet)
      _arg_quiet="on"
      test "${1:0:5}" = "--no-" && _arg_quiet="off"
      ;;
    -q*)
      _arg_quiet="on"
      _next="${_key##-q}"
      if test -n "$_next" -a "$_next" != "$_key"; then
        { begins_with_short_option "$_next" && shift && set -- "-q" "-${_next}" "$@"; } || die "The short option '$_key' can't be decomposed to ${_key:0:2} and -${_key:2}, because ${_key:0:2} doesn't accept value and '-${_key:2:1}' doesn't correspond to a short option."
      fi
      ;;
    -h | --help)
      print_help
      exit 0
      ;;
    -h*)
      print_help
      exit 0
      ;;
    *)
      _PRINT_HELP=yes die "FATAL ERROR: Got an unexpected argument '$1'" 1
      ;;
    esac
    shift
  done
}

parse_commandline "$@"

# OTHER STUFF GENERATED BY Argbash

### END OF CODE GENERATED BY Argbash (sortof) ### ])
# [ <-- needed because of Argbash

symlink_dir="ext"
target_dir="${script_dir}/ext"

# ensure target directory exists
if ! [ -d "${target_dir}" ]; then
  echo "The target directory '${target_dir}' does not exist" 1>&2
  exit 1
fi

# check whether or not symlink already exists
if [ -d "${symlink_dir}" ]; then
  if ! [ -L "${symlink_dir}" ]; then
    echo "The directory 'ext' already exists and is not a symlink" 1>&2
    exit 1
  fi
  if [ "${_arg_force}" == "off" ]; then
    [ ${_arg_quiet} == "off" ] && echo "Symlink to library already exists (it's fine). Use --force flag to recreate it" 1>&2
    exit 0
  fi
fi

# create symlink
rm -f "${symlink_dir}" && ln -s "${script_dir}/ext" || exit $?
[ ${_arg_quiet} == "off" ] && echo "Symlink to library successfully created" 1>&2

# ] <-- needed because of Argbash
