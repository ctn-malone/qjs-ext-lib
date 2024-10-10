/** @format */
// @ts-check

import arg from '../src/arg.js';
import * as path from '../src/path.js';
import { tester } from '../src/tester.js';
import testTimers from './tests/test.timers.js';
import testStrings from './tests/test.strings.js';
import testPath from './tests/test.path.js';
import testProcess from './tests/test.process.js';
import testCurl from './tests/test.curl.js';
import testVersion from './tests/test.version.js';
import testSsh from './tests/test.ssh.js';
import testGum from './tests/test.gum.js';
import testArg from './tests/test.arg.js';

import * as std from '../src/std.js';

const testSuites = [
  'timers',
  'strings',
  'path',
  'process',
  'curl',
  'version',
  'ssh',
  'gum',
  'arg',
];
const verbosity_levels = [1, 2, 3];

const getUsage = () => {
  const message = `
Usage: ${path.getScriptName(
    true
  )} [-h|--help] [-s|--suite] [-v|--verbosity] [--stop-on-failure] [--no-color]
    -s  --suite:          name of the test suite to run (by default run all test suites)
                          One of [${testSuites.join(',')}]
    -v  --verbosity:      report verbosity (default = 3). Should be one of below
                            - 3: print all assertions & final summary
                            - 2: only print failed assertions & final summary
                            - 1: only print final summary
    --stop-on-failure:    stop on first failure
    --no-color       :    do not use color
    -h, --help:           print help
`.trim();
  return message;
};

const getHelp = () => {
  const message = `
Run tests
`.trim();
  return `${message}\n${getUsage()}`;
};

let args;
try {
  args = arg({
    '--suite': (v, n, p) => {
      const value = v.trim();
      if (!testSuites.includes(value)) {
        const err = new Error(
          `Invalid option value: ${n} (${v}) (should be one of [${testSuites.join(
            ','
          )}])`
        );
        // @ts-ignore
        err.code = 'ARG_INVALID_OPTION';
        throw err;
      }
      return value;
    },
    '--verbosity': (v, n, p) => {
      const value = parseInt(v);
      let valid = true;
      if (isNaN(value) || !verbosity_levels.includes(value)) {
        const err = new Error(
          `Invalid option value: ${n} (${v}) (should be one of [${verbosity_levels.join(
            ','
          )}])`
        );
        // @ts-ignore
        err.code = 'ARG_INVALID_OPTION';
        throw err;
      }
      return value;
    },
    '--stop-on-failure': Boolean,
    '--no-color': Boolean,
    '--help': Boolean,
    // aliases
    '-s': '--suite',
    '-v': '--verbosity',
    '-h': '--help',
  });
} catch (e) {
  switch (e.code) {
    case 'ARG_UNKNOWN_OPTION':
    case 'ARG_INVALID_OPTION':
    case 'ARG_MISSING_REQUIRED_SHORTARG':
    case 'ARG_MISSING_REQUIRED_LONGARG':
      std.err.printf(`${e.message.trim()}\n`);
      std.err.printf(`${getUsage()}\n`);
      std.exit(2);
  }
  throw e;
}
if (args.get('--help')) {
  std.err.printf(`${getHelp()}\n`);
  std.exit(2);
}

tester.setReportVerbosity(args.get('--verbosity'));
tester.enableColorInReport(!args.get('--no-color'));
tester.displayResultsIfMismatch(true);
tester.setResultHandler((r) => {
  if (!r.success) {
    std.exit(1);
  }
  std.exit(0);
});

const testSuite = args.get('--suite');

if (undefined === testSuite || 'timers' === testSuite) {
  testTimers();
}
if (undefined === testSuite || 'strings' === testSuite) {
  testStrings();
}
if (undefined === testSuite || 'path' === testSuite) {
  testPath();
}
if (undefined === testSuite || 'process' === testSuite) {
  testProcess();
}
if (undefined === testSuite || 'curl' === testSuite) {
  testCurl();
}
if (undefined === testSuite || 'version' === testSuite) {
  testVersion();
}
if (undefined === testSuite || 'ssh' === testSuite) {
  testSsh();
}
if (undefined === testSuite || 'gum' === testSuite) {
  testGum();
}
if (undefined === testSuite || 'arg' === testSuite) {
  testArg();
}

tester.run({ stopOnFailure: args.get('--stop-on-failure') });
