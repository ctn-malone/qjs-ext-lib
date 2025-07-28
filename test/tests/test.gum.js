/** @format */
// @ts-check

import { tester } from '../../src/tester.js';
import * as gum from '../../src/gum.js';

/**
 * @param {string[]} cmdline
 * @param {string[]} expectedCmdline
 * @param {string} [message]
 */
const cmdlineShouldMatch = (cmdline, expectedCmdline, message) => {
  message = message || `Cmdline should be as expected`;
  tester.assertEq(cmdline, expectedCmdline, message);
};

/**
 * @param {Record<string, string>} env
 * @param {Record<string, string>} expectedEnv
 */
const envShouldContain = (env, expectedEnv) => {
  for (const [varName, varValue] of Object.entries(expectedEnv)) {
    tester.assert(
      env[varName] === varValue,
      `Environment variable ${varName} should be as expected`,
      {
        actualResult: env[varName],
        expectedResult: varValue,
      }
    );
  }
};

/**
 * @param {Record<string, string>} env
 * @param {Record<string, string|undefined>} notExpectedEnv
 */
const envShouldNotContain = (env, notExpectedEnv) => {
  for (const [varName, varValue] of Object.entries(notExpectedEnv)) {
    if (varValue === undefined) {
      tester.assert(
        env[varName] === undefined,
        `Environment variable ${varName} should not be present`,
        {
          actualResult: env[varName],
        }
      );
    } else {
      tester.assert(
        env[varName].toString() === varValue.toString(),
        `Environment variable ${varName} should not be '${varValue}'`,
        {
          actualResult: env[varName],
        }
      );
    }
  }
};

export default () => {
  tester.test('gum.chooseItemFromList (without options)', () => {
    gum.chooseItemFromList(['a', 'b', 'c'], {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'choose', '--limit', '1']);
          envShouldContain(env, {
            GUM_CHOOSE_HEIGHT: '10',
            GUM_CHOOSE_CURSOR: '> ',
          });
        },
      },
    });
  });

  tester.test('gum.chooseItemFromList (with options)', () => {
    gum.chooseItemFromList(['a', 'b', 'c'], {
      header: 'header',
      selected: 'a',
      cursor: '>>',
      height: 100,
      custom: {
        args: {
          limit: 10,
          'no-limit': undefined,
          test: 'extra-arg',
        },
        env: {
          GUM_CHOOSE_HEIGHT: 101,
          GUM_CHOOSE_CURSOR: 'cursor-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'choose',
            '--limit',
            '1',
            '--header',
            'header',
            '--selected',
            'a',
            '--cursor=>>',
            '--height',
            '100',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_CHOOSE_HEIGHT: '101',
            GUM_CHOOSE_CURSOR: 'cursor-var',
          });
        },
      },
    });
  });

  tester.test('gum.chooseItemsFromList (without options)', () => {
    gum.chooseItemsFromList(['a', 'b', 'c'], {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'choose', '--no-limit']);
          envShouldContain(env, {
            GUM_CHOOSE_HEIGHT: '10',
            GUM_CHOOSE_CURSOR: '> ',
          });
        },
      },
    });
  });

  tester.test('gum.chooseItemsFromList (with options)', () => {
    gum.chooseItemsFromList(['a', 'b', 'c'], {
      header: 'header',
      selected: ['a', 'b'],
      cursor: '>>',
      height: 100,
      limit: 50,
      ordered: true,
      cursorPrefix: '>>',
      selectedPrefix: '>>',
      unselectedPrefix: '>>',
      custom: {
        args: {
          limit: 10,
          'no-limit': undefined,
          test: 'extra-arg',
        },
        env: {
          GUM_CHOOSE_HEIGHT: 101,
          GUM_CHOOSE_CURSOR: 'cursor-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'choose',
            '--header',
            'header',
            '--selected',
            'a,b',
            '--cursor=>>',
            '--height',
            '100',
            '--limit',
            '50',
            '--ordered=yes',
            '--cursor-prefix=>>',
            '--selected-prefix=>>',
            '--unselected-prefix=>>',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_CHOOSE_HEIGHT: '101',
            GUM_CHOOSE_CURSOR: 'cursor-var',
          });
        },
      },
    });
  });

  tester.test('gum.filterItemFromList (without options)', () => {
    gum.filterItemFromList(['a', 'b', 'c'], {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'filter', '--limit', '1']);
          envShouldContain(env, {
            GUM_FILTER_PLACEHOLDER: 'Filter...',
            GUM_FILTER_WIDTH: '20',
            GUM_FILTER_PROMPT: '> ',
            GUM_FILTER_FUZZY: 'yes',
            GUM_FILTER_REVERSE: 'no',
            GUM_FILTER_SORT: 'yes',
            GUM_FILTER_HEIGHT: '50',
          });
        },
      },
    });
  });

  tester.test('gum.filterItemFromList (with options)', () => {
    gum.filterItemFromList(['a', 'b', 'c'], {
      header: 'header',
      placeholder: 'this is a placeholder',
      width: 100,
      height: 100,
      prompt: '>>',
      value: 'a',
      fuzzy: false,
      reverse: true,
      sort: false,
      custom: {
        args: {
          limit: 10,
          'no-limit': undefined,
          test: 'extra-arg',
        },
        env: {
          GUM_FILTER_PLACEHOLDER: 'placeholder-var',
          GUM_FILTER_WIDTH: 101,
          GUM_FILTER_PROMPT: 'prompt-var',
          GUM_FILTER_FUZZY: 'no-var',
          GUM_FILTER_REVERSE: 'yes-var',
          GUM_FILTER_SORT: 'no-var',
          GUM_FILTER_HEIGHT: 101,
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'filter',
            '--limit',
            '1',
            '--header',
            'header',
            '--placeholder',
            'this is a placeholder',
            '--width',
            '100',
            '--height',
            '100',
            '--prompt',
            '>>',
            '--value',
            'a',
            '--no-fuzzy',
            '--no-sort',
            '--reverse=yes',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_FILTER_PLACEHOLDER: 'placeholder-var',
            GUM_FILTER_WIDTH: '101',
            GUM_FILTER_PROMPT: 'prompt-var',
            GUM_FILTER_FUZZY: 'no-var',
            GUM_FILTER_REVERSE: 'yes-var',
            GUM_FILTER_SORT: 'no-var',
            GUM_FILTER_HEIGHT: '101',
          });
        },
      },
    });
  });

  tester.test('gum.filterItemsFromList (without options)', () => {
    gum.filterItemsFromList(['a', 'b', 'c'], {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'filter', '--no-limit']);
          envShouldContain(env, {
            GUM_FILTER_PLACEHOLDER: 'Filter...',
            GUM_FILTER_WIDTH: '20',
            GUM_FILTER_PROMPT: '> ',
            GUM_FILTER_FUZZY: 'yes',
            GUM_FILTER_REVERSE: 'no',
            GUM_FILTER_SORT: 'yes',
            GUM_FILTER_INDICATOR: '•',
            GUM_FILTER_SELECTED_PREFIX: ' ◉ ',
            GUM_FILTER_UNSELECTED_PREFIX: ' ○ ',
            GUM_FILTER_HEIGHT: '50',
          });
        },
      },
    });
  });

  tester.test('gum.filterItemsFromList (with options)', () => {
    gum.filterItemsFromList(['a', 'b', 'c'], {
      header: 'header',
      placeholder: 'this is a placeholder',
      width: 100,
      height: 100,
      prompt: '>>',
      value: 'a',
      fuzzy: false,
      reverse: true,
      sort: false,
      custom: {
        args: {
          limit: 10,
          'no-limit': undefined,
          test: 'extra-arg',
        },
        env: {
          GUM_FILTER_PLACEHOLDER: 'placeholder-var',
          GUM_FILTER_WIDTH: 101,
          GUM_FILTER_HEIGHT: 101,
          GUM_FILTER_PROMPT: 'prompt-var',
          GUM_FILTER_FUZZY: 'yes-var',
          GUM_FILTER_REVERSE: 'no-var',
          GUM_FILTER_SORT: 'yes-var',
          GUM_FILTER_INDICATOR: 'indicator-var',
          GUM_FILTER_SELECTED_PREFIX: 'selected-prefix-var',
          GUM_FILTER_UNSELECTED_PREFIX: 'unselected-prefix-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'filter',
            '--header',
            'header',
            '--placeholder',
            'this is a placeholder',
            '--width',
            '100',
            '--height',
            '100',
            '--prompt',
            '>>',
            '--value',
            'a',
            '--no-fuzzy',
            '--no-sort',
            '--reverse=yes',
            '--no-limit',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_FILTER_PLACEHOLDER: 'placeholder-var',
            GUM_FILTER_WIDTH: '101',
            GUM_FILTER_HEIGHT: '101',
            GUM_FILTER_PROMPT: 'prompt-var',
            GUM_FILTER_FUZZY: 'yes-var',
            GUM_FILTER_REVERSE: 'no-var',
            GUM_FILTER_SORT: 'yes-var',
            GUM_FILTER_INDICATOR: 'indicator-var',
            GUM_FILTER_SELECTED_PREFIX: 'selected-prefix-var',
            GUM_FILTER_UNSELECTED_PREFIX: 'unselected-prefix-var',
          });
        },
      },
    });
  });

  tester.test('gum.style (without options)', () => {
    gum.style('text to style', {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'style',
            'text to style',
            '--margin',
            '0 0 0 0',
            '--padding',
            '0 0 0 0',
          ]);
          envShouldContain(env, {
            BORDER: gum.Border.NONE,
            ALIGN: gum.Align.LEFT,
            HEIGHT: '1',
            WIDTH: '0',
            BOLD: 'no',
            ITALIC: 'no',
            STRIKETHROUGH: 'no',
            UNDERLINE: 'no',
            FAINT: 'no',
          });
          envShouldNotContain(env, {
            BACKGROUND: undefined,
            FOREGROUND: undefined,
            BORDER_BACKGROUND: undefined,
            BORDER_FOREGROUND: undefined,
            MARGIN: undefined,
            PADDING: undefined,
            MARGIN_LEFT: undefined,
            MARGIN_RIGHT: undefined,
            MARGIN_TOP: undefined,
            MARGIN_BOTTOM: undefined,
            PADDING_LEFT: undefined,
            PADDING_RIGHT: undefined,
            PADDING_TOP: undefined,
            PADDING_BOTTOM: undefined,
          });
        },
      },
    });
  });

  tester.test('gum.style, text as string[] (without options)', () => {
    gum.style(['text to style', 'another text to style'], {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'style',
            'text to style',
            'another text to style',
            '--margin',
            '0 0 0 0',
            '--padding',
            '0 0 0 0',
          ]);
          envShouldContain(env, {
            BORDER: gum.Border.NONE,
            ALIGN: gum.Align.LEFT,
            HEIGHT: '1',
            WIDTH: '0',
            BOLD: 'no',
            ITALIC: 'no',
            STRIKETHROUGH: 'no',
            UNDERLINE: 'no',
            FAINT: 'no',
          });
          envShouldNotContain(env, {
            BACKGROUND: undefined,
            FOREGROUND: undefined,
            BORDER_BACKGROUND: undefined,
            BORDER_FOREGROUND: undefined,
            MARGIN: undefined,
            PADDING: undefined,
            MARGIN_LEFT: undefined,
            MARGIN_RIGHT: undefined,
            MARGIN_TOP: undefined,
            MARGIN_BOTTOM: undefined,
            PADDING_LEFT: undefined,
            PADDING_RIGHT: undefined,
            PADDING_TOP: undefined,
            PADDING_BOTTOM: undefined,
          });
        },
      },
    });
  });

  tester.test('gum.style (with options)', () => {
    gum.style('text to style', {
      background: '212',
      foreground: '212',
      border: gum.Border.NONE,
      borderBackground: '212',
      borderForeground: '212',
      align: gum.Align.LEFT,
      height: 100,
      width: 101,
      marginTop: 100,
      marginBottom: 101,
      marginLeft: 102,
      marginRight: 103,
      paddingTop: 104,
      paddingBottom: 105,
      paddingLeft: 106,
      paddingRight: 107,
      bold: true,
      italic: true,
      strikethrough: true,
      underline: true,
      faint: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          BORDER: 'border-var',
          ALIGN: 'align-var',
          HEIGHT: '101',
          WIDTH: '101',
          MARGIN_TOP: '200',
          MARGIN_BOTTOM: '201',
          MARGIN_LEFT: '202',
          MARGIN_RIGHT: '203',
          PADDING_TOP: '204',
          PADDING_BOTTOM: '205',
          PADDING_LEFT: '206',
          PADDING_RIGHT: '207',
          BOLD: 'no-var',
          ITALIC: 'no-var',
          STRIKETHROUGH: 'no-var',
          UNDERLINE: 'no-var',
          FAINT: 'no-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'style',
            'text to style',
            '--background',
            '212',
            '--foreground',
            '212',
            '--border',
            gum.Border.NONE,
            '--border-background',
            '212',
            '--border-foreground',
            '212',
            '--align',
            gum.Align.LEFT,
            '--height',
            '100',
            '--width',
            '101',
            '--margin',
            '100 103 101 102',
            '--padding',
            '104 107 105 106',
            '--bold=yes',
            '--italic=yes',
            '--strikethrough=yes',
            '--underline=yes',
            '--faint=yes',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            BORDER: 'border-var',
            ALIGN: 'align-var',
            HEIGHT: '101',
            WIDTH: '101',
            BOLD: 'no-var',
            ITALIC: 'no-var',
            STRIKETHROUGH: 'no-var',
            UNDERLINE: 'no-var',
            FAINT: 'no-var',
          });
          envShouldNotContain(env, {
            MARGIN: undefined,
            PADDING: undefined,
            MARGIN_LEFT: undefined,
            MARGIN_RIGHT: undefined,
            MARGIN_TOP: undefined,
            MARGIN_BOTTOM: undefined,
            PADDING_LEFT: undefined,
            PADDING_RIGHT: undefined,
            PADDING_TOP: undefined,
            PADDING_BOTTOM: undefined,
          });
        },
      },
    });
  });

  tester.test('gum.renderTable (without options)', () => {
    gum.renderTable(
      ['col1', 'col2', 'col3'],
      [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ],
      {
        custom: {
          dryRunCb: (cmdline) => {
            cmdlineShouldMatch(cmdline, [
              'gum',
              'table',
              '--print',
              '--separator',
              ',',
              '--columns',
              'col1,col2,col3',
              '--border',
              'rounded',
            ]);
          },
        },
      }
    );
  });

  tester.test('gum.renderTable (with options)', () => {
    gum.renderTable(
      ['col1', 'col2', 'col3'],
      [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ],
      {
        border: gum.Border.DOUBLE,
        widths: [10, 20, 30],
        custom: {
          args: {
            test: 'extra-arg',
          },
          dryRunCb: (cmdline) => {
            cmdlineShouldMatch(cmdline, [
              'gum',
              'table',
              '--print',
              '--separator',
              ',',
              '--columns',
              'col1,col2,col3',
              '--border',
              'double',
              '--widths',
              '10,20,30',
              '--test',
              'extra-arg',
            ]);
          },
        },
      }
    );
  });

  tester.test('gum.chooseRowFromTable (without options)', () => {
    gum.chooseRowFromTable(
      ['col1', 'col2', 'col3'],
      [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ],
      {
        custom: {
          dryRunCb: (cmdline) => {
            cmdlineShouldMatch(cmdline, [
              'gum',
              'table',
              '--separator',
              ',',
              '--columns',
              'col1,col2,col3',
              '--height',
              '20',
              '--widths',
              '4,4,4',
            ]);
          },
        },
      }
    );
  });

  tester.test('gum.chooseRowFromTable (with options)', () => {
    gum.chooseRowFromTable(
      ['col1', 'col2', 'col3'],
      [
        ['a1', 'b1', 'c1'],
        ['a2', 'b2', 'c2'],
      ],
      {
        height: 100,
        widths: [10, 20, 30],
        custom: {
          args: {
            test: 'extra-arg',
          },
          dryRunCb: (cmdline) => {
            cmdlineShouldMatch(cmdline, [
              'gum',
              'table',
              '--separator',
              ',',
              '--columns',
              'col1,col2,col3',
              '--height',
              '100',
              '--widths',
              '10,20,30',
              '--test',
              'extra-arg',
            ]);
          },
        },
      }
    );
  });

  tester.test('gum.confirm (without options)', () => {
    gum.confirm({
      custom: {
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'confirm',
            '--default=yes',
            '--affirmative',
            'Yes',
            '--negative',
            'No',
            'Are you sure?',
          ]);
        },
      },
    });
  });

  tester.test('gum.confirm (with options)', () => {
    gum.confirm({
      prompt: 'Are you really sure?',
      affirmative: 'Yes!',
      negative: 'No!',
      default: 'no',
      custom: {
        args: {
          test: 'extra-arg',
        },
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'confirm',
            '--default=no',
            '--affirmative',
            'Yes!',
            '--negative',
            'No!',
            'Are you really sure?',
            '--test',
            'extra-arg',
          ]);
        },
      },
    });
  });

  tester.test('gum.chooseFile (without options)', () => {
    gum.chooseFile({
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'file',
            '--file=true',
            '--directory=false',
          ]);
          envShouldContain(env, {
            GUM_FILE_CURSOR: '>',
            GUM_FILE_HEIGHT: '50',
          });
        },
      },
    });
  });

  tester.test('gum.chooseFile (with options)', () => {
    gum.chooseFile({
      path: '/tmp',
      cursor: '>>',
      height: 100,
      all: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_FILE_CURSOR: 'cursor-var',
          GUM_FILE_HEIGHT: 101,
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'file',
            '--file=true',
            '--directory=false',
            '--cursor=>>',
            '--all',
            '--height',
            '100',
            '/tmp',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_FILE_CURSOR: 'cursor-var',
            GUM_FILE_HEIGHT: '101',
          });
        },
      },
    });
  });

  tester.test('gum.chooseDirectory (without options)', () => {
    gum.chooseDirectory({
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'file',
            '--file=false',
            '--directory=true',
          ]);
          envShouldContain(env, {
            GUM_FILE_CURSOR: '>',
            GUM_FILE_HEIGHT: '50',
          });
        },
      },
    });
  });

  tester.test('gum.chooseDirectory (with options)', () => {
    gum.chooseDirectory({
      path: '/tmp',
      cursor: '>>',
      height: 100,
      all: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_FILE_CURSOR: 'cursor-var',
          GUM_FILE_HEIGHT: 101,
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'file',
            '--file=false',
            '--directory=true',
            '--cursor=>>',
            '--all',
            '--height',
            '100',
            '/tmp',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_FILE_CURSOR: 'cursor-var',
            GUM_FILE_HEIGHT: '101',
          });
        },
      },
    });
  });

  tester.test('gum.spin (< 0.15.1, without options)', () => {
    gum.spin(Promise.resolve(), {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'spin', '--', 'tail', '-f']);
          envShouldContain(env, {
            GUM_SPIN_TITLE: 'Loading...',
            GUM_SPIN_SPINNER: gum.Spinner.DOT,
            GUM_SPIN_ALIGN: gum.Align.LEFT,
          });
        },
        dryRunVersion: '0.12.0',
      },
    });
  });

  tester.test('gum.spin (>= 0.15.1, without options)', () => {
    gum.spin(Promise.resolve(), {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'spin',
            '--show-stdout',
            '--',
            'tail',
            '-1',
          ]);
          envShouldContain(env, {
            GUM_SPIN_TITLE: 'Loading...',
            GUM_SPIN_SPINNER: gum.Spinner.DOT,
            GUM_SPIN_ALIGN: gum.Align.LEFT,
          });
        },
        dryRunVersion: '0.16.0',
      },
    });
  });

  tester.test('gum.spin (>= 0.15.1, with options)', () => {
    gum.spin(Promise.resolve(), {
      title: 'Loading, please wait...',
      spinner: gum.Spinner.GLOBE,
      align: gum.Align.RIGHT,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_SPIN_TITLE: 'title-var',
          GUM_SPIN_SPINNER: 'spinner-var',
          GUM_SPIN_ALIGN: 'align-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'spin',
            '--show-stdout',
            '--title',
            'Loading, please wait...',
            '--spinner',
            gum.Spinner.GLOBE,
            '--align',
            gum.Align.RIGHT,
            '--test',
            'extra-arg',
            '--',
            'tail',
            '-1',
          ]);
          envShouldContain(env, {
            GUM_SPIN_TITLE: 'title-var',
            GUM_SPIN_SPINNER: 'spinner-var',
            GUM_SPIN_ALIGN: 'align-var',
          });
        },
        dryRunVersion: '0.16.0',
      },
    });
  });

  tester.test('gum.input (without options)', () => {
    gum.input({
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'input', '--char-limit', '400']);
          envShouldContain(env, {
            GUM_INPUT_PLACEHOLDER: 'Type something...',
            GUM_INPUT_CURSOR_MODE: gum.CursorMode.BLINK,
            GUM_INPUT_WIDTH: '0',
            GUM_INPUT_PROMPT: '> ',
          });
        },
      },
    });
  });

  tester.test('gum.input (with options)', () => {
    gum.input({
      header: 'header',
      placeholder: 'this is a placeholder',
      cursorMode: gum.CursorMode.STATIC,
      prompt: '>>',
      charLimit: 401,
      width: 100,
      value: 'initial value',
      password: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_INPUT_PLACEHOLDER: 'placeholder-var',
          GUM_INPUT_CURSOR_MODE: 'cursor-mode-var',
          GUM_INPUT_WIDTH: 101,
          GUM_INPUT_PROMPT: 'prompt-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'input',
            '--header',
            'header',
            '--placeholder',
            'this is a placeholder',
            '--prompt',
            '>>',
            '--value',
            'initial value',
            '--password',
            '--char-limit',
            '401',
            '--width',
            '100',
            '--cursor.mode',
            'static',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_INPUT_PLACEHOLDER: 'placeholder-var',
            GUM_INPUT_CURSOR_MODE: 'cursor-mode-var',
            GUM_INPUT_WIDTH: '101',
            GUM_INPUT_PROMPT: 'prompt-var',
          });
        },
      },
    });
  });

  tester.test('gum.write (without options)', () => {
    gum.write({
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'write', '--char-limit', '400']);
          envShouldContain(env, {
            GUM_WRITE_CURSOR_MODE: gum.CursorMode.BLINK,
            GUM_WRITE_PLACEHOLDER: 'Write something...',
            GUM_WRITE_PROMPT: '┃ ',
            GUM_WRITE_WIDTH: '50',
            GUM_WRITE_HEIGHT: '10',
            GUM_WRITE_SHOW_LINE_NUMBERS: 'no',
          });
        },
      },
    });
  });

  tester.test('gum.write (with options)', () => {
    gum.write({
      header: 'header',
      placeholder: 'this is a placeholder',
      cursorMode: gum.CursorMode.STATIC,
      prompt: '>>',
      charLimit: 401,
      width: 100,
      height: 100,
      showLineNumbers: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_WRITE_CURSOR_MODE: 'cursor-mode-var',
          GUM_WRITE_PLACEHOLDER: 'placeholder-var',
          GUM_WRITE_PROMPT: 'prompt-var',
          GUM_WRITE_WIDTH: '101',
          GUM_WRITE_HEIGHT: '101',
          GUM_WRITE_SHOW_LINE_NUMBERS: 'no-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'write',
            '--header',
            'header',
            '--placeholder',
            'this is a placeholder',
            '--prompt',
            '>>',
            '--char-limit',
            '401',
            '--width',
            '100',
            '--height',
            '100',
            '--cursor.mode',
            'static',
            '--show-line-numbers=yes',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_WRITE_CURSOR_MODE: 'cursor-mode-var',
            GUM_WRITE_PLACEHOLDER: 'placeholder-var',
            GUM_WRITE_PROMPT: 'prompt-var',
            GUM_WRITE_WIDTH: '101',
            GUM_WRITE_HEIGHT: '101',
            GUM_WRITE_SHOW_LINE_NUMBERS: 'no-var',
          });
        },
      },
    });
  });

  tester.test('gum.format (without options)', () => {
    gum.format('text', {
      custom: {
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, ['gum', 'format', 'text']);
          envShouldContain(env, {
            GUM_FORMAT_TYPE: gum.FormatType.MARKDOWN,
            GUM_FORMAT_THEME: gum.FormatTheme.PINK,
          });
        },
      },
    });
  });

  tester.test('gum.format (with options)', () => {
    gum.format('text', {
      type: gum.FormatType.CODE,
      theme: gum.FormatTheme.DARK,
      language: 'js',
      custom: {
        args: {
          test: 'extra-arg',
        },
        env: {
          GUM_FORMAT_TYPE: 'type-var',
          GUM_FORMAT_LANGUAGE: 'language-var',
          GUM_FORMAT_THEME: 'theme-var',
        },
        dryRunCb: (cmdline, env) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'format',
            'text',
            '--type',
            'code',
            '--theme',
            'dark',
            '--language',
            'js',
            '--test',
            'extra-arg',
          ]);
          envShouldContain(env, {
            GUM_FORMAT_TYPE: 'type-var',
            GUM_FORMAT_THEME: 'theme-var',
            GUM_FORMAT_LANGUAGE: 'language-var',
          });
        },
      },
    });
  });

  tester.test('gum.join (without options)', () => {
    gum.join(['text1', 'text2'], {
      custom: {
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'join',
            'text1',
            'text2',
            '--align',
            'left',
            '--horizontal',
          ]);
        },
      },
    });
  });

  tester.test('gum.join (with options)', () => {
    gum.join(['text1', 'text2'], {
      align: gum.Align.RIGHT,
      direction: gum.JoinDirection.VERTICAL,
      custom: {
        args: {
          test: 'extra-arg',
          horizontal: undefined,
        },
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'join',
            'text1',
            'text2',
            '--align',
            'right',
            '--vertical',
            '--test',
            'extra-arg',
          ]);
        },
      },
    });
  });

  tester.test('gum.pager (without options)', () => {
    gum.pager('content', {
      custom: {
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'pager',
            'content',
            '--show-line-numbers=yes',
            '--soft-wrap=no',
          ]);
        },
      },
    });
  });

  tester.test('gum.pager (with options)', () => {
    gum.pager('content', {
      showLineNumbers: false,
      softWrap: true,
      custom: {
        args: {
          test: 'extra-arg',
        },
        dryRunCb: (cmdline) => {
          cmdlineShouldMatch(cmdline, [
            'gum',
            'pager',
            'content',
            '--show-line-numbers=no',
            '--soft-wrap=yes',
            '--test',
            'extra-arg',
          ]);
        },
      },
    });
  });
};
