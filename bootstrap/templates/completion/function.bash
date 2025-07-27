_qel_completion() {
  local IFS=$'\n'

  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword

  # command which triggered the completion
  local cmd=${words[0]}
  local extension="${cmd##*.}"

  # call command to get completions
  local output
  if [[ "${extension}" == 'js' ]]; then
    output=$(COMP_LINE="${COMP_LINE}" COMP_POINT="${COMP_POINT}" qjs.sh ${cmd})
  else
    output=$(COMP_LINE="${COMP_LINE}" COMP_POINT="${COMP_POINT}" ${cmd})
  fi

  if [[ -n "${output}" ]]; then
    case "$output" in
    "@QEL_DIR@")
      # complete only directories
      _filedir -d
      ;;
    "@QEL_PATH@")
      # complete files and directories
      _filedir
      ;;
    *)
      # use completions from command
      COMPREPLY=($output)
      ;;
    esac
  fi
}