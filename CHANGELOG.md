# Change Log

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
