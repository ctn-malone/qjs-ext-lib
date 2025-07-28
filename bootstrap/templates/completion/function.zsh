_qel_completion() {
  # full command line up to cursor position
  local cmd_line="${BUFFER[1, $CURSOR]}"

  # command which triggered the completion
  local cmd="${words[1]}"
  local extension="${cmd##*.}"

  # call command to get completions
  local output
  if [[ "${extension}" == 'js' ]]; then
    output=$(QEL_COMPLETION_SHELL=zsh COMP_LINE="${cmd_line}" COMP_POINT="${CURSOR}" qjs.sh ${cmd})
  else
    output=$(QEL_COMPLETION_SHELL=zsh COMP_LINE="${cmd_line}" COMP_POINT="${CURSOR}" ${cmd})
  fi

  if [[ -n "${output}" ]]; then
    case "$output" in
    "@QEL_DIR@")
      # complete only directories
      _files -/
      ;;
    "@QEL_PATH@")
      # complete files and directories
      _files
      ;;
    *)
      # use completions from command
      local completions=("${(f)${output}}")
      completions=("${(f)output}")
      _describe 'completions' completions
      ;;
    esac
  fi
}