/** @format */
// @ts-check

import { tester } from '../../src/tester.js';
import * as arg from '../../src/internal/arg.js';

const goldenTests = {
  'a \'b\' "c"': [
    {
      content: 'a',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'b',
      index: 2,
      quoteChar: "'",
      endingQuote: true,
    },
    {
      content: 'c',
      index: 6,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  'beep "boop" \'foo bar baz\' "it\'s \\"so\\" groovy"': [
    {
      content: 'beep',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'boop',
      index: 5,
      quoteChar: '"',
      endingQuote: true,
    },
    {
      content: 'foo bar baz',
      index: 12,
      quoteChar: "'",
      endingQuote: true,
    },
    {
      content: 'it\'s "so" groovy',
      index: 26,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  'a b\\ c d': [
    {
      content: 'a',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'b c',
      index: 2,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'd',
      index: 7,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  '\\$beep bo\\`op': [
    {
      content: '\\$beep',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'bo`op',
      index: 7,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo "foo = \\"foo\\""': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'foo = "foo"',
      index: 5,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  '': [],
  ' ': [],
  '\t': [],
  'a"b c d"e': [
    {
      content: 'ab c de',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'a\\ b"c d"\\ e f': [
    {
      content: 'a bc d e',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'f',
      index: 13,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'a\\ b"c d"\\ e\'f g\' h': [
    {
      content: 'a bc d ef g',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'h',
      index: 18,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  "x \"bl'a\"'h'": [
    {
      content: 'x',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: "bl'ah",
      index: 2,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  "unmatched quote 'test": [
    {
      content: 'unmatched',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'quote',
      index: 10,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'test',
      index: 16,
      quoteChar: "'",
      endingQuote: false,
    },
  ],
  'ls $(echo /home)': [
    {
      content: 'ls',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(echo /home)',
      index: 3,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo $(ls -la /var/log)': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(ls -la /var/log)',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo $(date) $(whoami)': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(date)',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(whoami)',
      index: 13,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo $(echo $(date))': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(echo $(date))',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'find $(cd $(dirname $(pwd)))': [
    {
      content: 'find',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(cd $(dirname $(pwd)))',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo "$(whoami)"': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(whoami)',
      index: 5,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  "echo '$(whoami)'": [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(whoami)',
      index: 5,
      quoteChar: "'",
      endingQuote: true,
    },
  ],
  'echo "User: $(whoami)"': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'User: $(whoami)',
      index: 5,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  'echo "Current dir: $(pwd)" and "User: $(whoami)"': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'Current dir: $(pwd)',
      index: 5,
      quoteChar: '"',
      endingQuote: true,
    },
    {
      content: 'and',
      index: 27,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'User: $(whoami)',
      index: 31,
      quoteChar: '"',
      endingQuote: true,
    },
  ],
  'echo $(grep "$PATTERN" ${FILE})': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(grep "$PATTERN" ${FILE})',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo \\$(not a subshell) $(real subshell)': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '\\$(not',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'a',
      index: 12,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: 'subshell)',
      index: 14,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(real subshell)',
      index: 24,
      quoteChar: null,
      endingQuote: false,
    },
  ],
  'echo $(incomplete': [
    {
      content: 'echo',
      index: 0,
      quoteChar: null,
      endingQuote: false,
    },
    {
      content: '$(incomplete',
      index: 5,
      quoteChar: null,
      endingQuote: false,
    },
  ],
};

export default () => {
  tester.test('arg (internal) - parseCmdLine', () => {
    for (const [cmdLine, expectedTokens] of Object.entries(goldenTests)) {
      const tokens = arg.parseCmdLine(cmdLine);
      tester.assertEq(
        tokens,
        expectedTokens,
        `it should correctly parse ${JSON.stringify(cmdLine)}`
      );
    }

    // handle --xy="val"
    let cmdLine = 'prog --arg="val';
    let tokens = arg.parseCmdLine(cmdLine);
    tester.assertEq(
      tokens,
      [
        {
          content: 'prog',
          index: 0,
          quoteChar: null,
          endingQuote: false,
        },
        {
          content: '--arg="val',
          index: 5,
          quoteChar: null,
          endingQuote: false,
        },
      ],
      `it should correctly parse ${JSON.stringify(cmdLine)}`
    );

    // handle --xy="val"
    cmdLine = "prog --arg='val";
    tokens = arg.parseCmdLine(cmdLine);
    tester.assertEq(
      tokens,
      [
        {
          content: 'prog',
          index: 0,
          quoteChar: null,
          endingQuote: false,
        },
        {
          content: "--arg='val",
          index: 5,
          quoteChar: null,
          endingQuote: false,
        },
      ],
      `it should correctly parse ${JSON.stringify(cmdLine)}`
    );
  });
};
