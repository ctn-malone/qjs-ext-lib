# Change Log

## [0.16.1]
* fix: fix typo in version comparison (`gum.js`)
* fix: rename ignored variables for padding (`gum.js`)

## [0.16.0]
* feat: add support for [gum](https://github.com/charmbracelet/gum) version (`v0.17.0`) (`gum.js`)
* refactor: use [gum](https://github.com/charmbracelet/gum) version (`v0.17.0`) in bootstrap

## [0.15.4]
* refactor: improve typing (`process.js`, `curl.js`)
* feat: add `getChildPids` function (`process.js`)
* refactor: new implementation for `kill` function (`process.js`)
* refactor: new implementation for `spin` function (`gum.js`)

## [0.15.3]
* refactor: don't stream output for base64 functions (`strings.js`)
* fix: correctly handle `byteOffset` in `strToBytesArray` (`strings.js`)
* fix: correctly handle `byteOffset` in `base64EncodeBytesArray` (`strings.js`)

## [0.15.2]
* refactor: add `#compdef` line at the beginning of `zsh` completion file
* feat: add support for killing a process recursively (`process.js`)
* feat: define `os.SIGKILL` and `os.SIGHUP` (`os.js`)
* refactor: improve typing of `arg` module (`arg.js`)

## [0.15.1]
* fix: escape some characters in `bash` completion (`args.js`)
  
## [0.15.0]
* chore: update `flake.nix` template
* chore: add a _shebang_ to script templates
* chore: indicate whether or not a script supports completion in `qel.config.json`
* chore: update `quickjs-cross-compiler` version in `flake.nix`
* chore: add `qel-completion.sh` script to generate completion for both `bash` and `zsh`
* chore: setup shell completion when entering `nix develop` shell
* fix: fix `qel-upgrade.sh` script
* fix: close file handle after ensuring a file exists (`args.js`)
* fix: escape `:` when generating completions for `zsh`
* refactor: make `errno` optional in `errorObj` (`std.js`, `os.js`)
  
## [0.14.2]
* fix: fix `getScriptDir` function for compiled scripts (`path.js`)
* fix: fix version comparison (`version.js`)
* fix: fix a typo in completion (`arg.js`)
  - Thanks https://github.com/nicolasduteil
* fix: fix [gum](https://github.com/charmbracelet/gum) styling (ignored because of `stderr` redirection) (`gum.js`)
* feat: the callback passed to `os.signal` will receive a `restoreHandler` callback which can be used to restore previous handler
* refactor: improve compatibility with latest [gum](https://github.com/charmbracelet/gum) version (`v0.16.0`) (`gum.js`)

## [0.14.1]
* fix: fix `--no-x` flag support (`arg.js`)
* feat: add support for `--ipv4` and `--ipv6` flags (`curl.js`)
* feat: add a `handleCurlRequestError` helper function (`curl.js`)

## [0.14.0]
* feat: first attempt at providing `bash` and `zsh` completion (`arg.js`)
* refactor: support `QEL_SCRIPT_NAME` environment variable to customize the script name in `--help` output (`arg.js`)
* docs(type): improve type documentation for `std` functions (`std.js`)
* docs(type): improve type documentation for `os` functions (`os.js`)

## [0.13.0]
* feat: add functions to mimic _Node.js_ `path` module (`path.js`)
* feat: add a `passStdout` option to `ProcessSync` (`process.js`)
* docs: add TOC to each module documentation

## [0.12.5]
* fix: ignore `pause`, `resume` and `kill` methods if process has not been started (`process.js`)
* fix: fix typing for `std.tmpfile` function (`std.js`)

## [0.12.4]
* chore: pin `gum` to version `0.12` in flake. Newer versions have a broken `gum spin` behaviour

## [0.12.3]
* refactor: improve typing of `os` module (`os.js`)
* refactor: improve typing of event listeners (`process.js`, `gum.js`, `ssh.js`)
* fix: disable `passStderr` pass in some gum function

## [0.12.2]
* refactor: improve typing of `ArgOuput.get` function and arg validators definition (`arg.js`)

## [0.12.1]
* feat: add `chooseDirectory` function (`gum.js`)
* refactor: set default height to `50` for `gum filter` and `gum file` wrappers (`gum.js`)
* feat: add support for trimming the content of a `path` argument (`arg.js`)

## [0.12.0]
* refactor: add *JSDoc* support for `os` and `std` modules
* refactor: replace `os` and `std` imports with `./os.js` and `./std.js` to get completion
* refactor: ensure `// @ts-check` is set in `.js` files
* feat: add `notNull` function to simulate `!` typescript operator (*non-null* assertion) (`types.js`)

## [0.11.0]
* refactor: improve *JSDoc* support (`ssh.js`)
* fix: throw an error when no value was provided for a validator which can be defined multiple times (`arg.js`)
* feat: possibility to override the usage message for enum values (`arg.js`)
* feat: new _bootstrap_ script to create a new project
* fix: detect whether or not query parameters exist in the url (`curl.js`)

## [0.10.0]
* feat: improve cmdline arguments parsing (`arg.js`)

## [0.9.1]
* feat: possibility to disable `stdout` streaming when executing a process (`process.js`)
* feat: possiblity to disable `[]` in query string when same parameter is defined multiple times (`curl.js`)
* refactor: disable `stdout` streaming by default (`curl.js`), to improve performances on large payload

## [0.9.0]
* refactor: improve *JSDoc* support
* feat: add support for [gum](https://github.com/charmbracelet/gum) binary
  - Thanks https://github.com/nicolasduteil

## [0.8.1]
* feat: support `passStderr` options for asynchronous processes (`process.js`)

## [0.8.0]
* fix: match error for test function with tag (`tester.js`)
  - Thanks https://github.com/ryougiii
* feat: possibility to execute a process synchronously (`process.js`)

## [0.7.2]
* fix: correctly handle a `200 OK` which is interleaved with curl progress (`curl.js`)

## [0.7.1]
* feat: possibility disable extra processing (ie: use `--data-binary`) when passing body from file (`curl.js`)

## [0.7.0]
* feat: wrapper to interact with [pass](https://www.passwordstore.org) (`password-store.js`)
* feat: function to retrieve home directory (`path.js`)

## [0.6.4]
* feat: possibility to define content type when uploading a file (`curl.js`)

## [0.6.3]
* feat: add support for setting *stdout* handle for curl process (`curl.js`)

## [0.6.2]
* fix: fix parsing of incomplete ssh debug lines (`ssh.js`)

## [0.6.1]
* feat: possibility to pass extra form data when uploading a file (`curl.js`)
* feat: possibility to pass input as string when executing a command (`process.js`)

## [0.6.0]
* feat: new internal function `strToBytesArray` to convert a `string` to a n `Uint8Array` (`strings.js`)
* refactor!: renamed internal function `utf8ArrayToStr` to `bytesArrayToStr` and changed prototype (`strings.js`)
* fix: close stdout & stderr pipes after execution (`process.js`)

## [0.5.0]
* feat: allow to pass same header multiple time (`curl.js`)
* feat: possibility to define how duplicate response headers should be handled (`curl.js`)
* feat: support for cookies (`curl.js`)

## [0.4.1]
* fix: fix semver comparison (`version.js`)

## [0.4.0]
* feat: add timestamp when emitting `stdout` and `stderr` events (`process.js`)
* feat: add extra function to fallback to a default value when a command line argument is missing (`arg.js`)
* feat: allow to pass custom properties to `Process` constructor (`process.js`)
* feat: possibility to use custom buffer size when reading from child process streams (`process.js`)
* refactor: set default buffer size to `512` bytes
* fix: remove loop when reading from child process

## [0.3.4]
* feat: add support for setting *stdout* handle in the child process (`process.js`)
* feat: add support for outputting to a file only if a given condition was fulfilled (`curl.js`)
* feat: support broader semver format (`version.js`)

## [0.3.3]
* feat: add support for setting *stdin* handle in the child process (`process.js`)
* feat: add support for setting *stdin* handle for curl process (`curl.js`)

## [0.3.2]
* feat: add support for passing *JSON* body from a file (`curl.js`)
* feat: add support for passing *raw* body from a file (`curl.js`)

## [0.3.1]
* feat: add support for *JWT* in *curl* requests (`curl.js`)
* feat: add `error` property to `Curl` (`curl.js`)
* fix: remove progress meter from `Curl.curlError` (`curl.js`)

## [0.3.0]
* Possibility to indicate that a test should be skipped using `opt.skip` (`tester.js`)
* Possibility to repeat a test multiple times using `opt.repeat` (`tester.js`)
* Wrapper around *ssh* binary (`ssh.js`)
* Wrapper around *ssh-agent* binary (`ssh.js`)

## [0.2.3]
* Move `getLines` from `process.js` to `strings.js`
* Add static method `getSignalName` to `Process` (`process.js`)
* Add property `wasCancelled` to know whether or not a curl request was cancelled (`curl.js`)
* Update documentation for `version` module
* Reset buffered output everytime `run` method is called (`process.js`)

## [0.2.2]
* Provide extra information in case of mismatch when using `tester.eq` (`tester.js)
* Change interface of custom reporter (`tester.js`)

## [0.2.1]
* Fix `getScriptName` function (`path.js`)

## [0.2.0]
* Provide argument index to custom validator (`arg.js`)
* Change interface of custom reporter (`tester.js`)
* Invert arguments `target` & `current` (`version.js`)

## [0.1.1]
* Throw an error if an empty `cmdline` argument is passed to `Process` constructor (`process.js`)
* Change interface of custom reporter (`tester.js`)

## [0.1.0]
* Initial version
