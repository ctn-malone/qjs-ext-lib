# Change Log

## [0.2.3] **NOT RELEASED**
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
