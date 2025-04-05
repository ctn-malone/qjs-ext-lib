#!/usr/bin/env -S qjs.sh --unhandled-rejection -m
/** @format */
// @ts-check

import * as std from './ext/std.js';

import arg from './ext/arg.js';
import { exec } from './ext/process.js';
import * as gum from './ext/gum.js';

/*
  Let user execute one of the following actions

  - display date
  - display uptime
  - render markdown content
 */

const args = arg
  .parser({
    '--command': arg
      .str()
      .req()
      .enum(['date', 'uptime', 'markdown'])
      .desc('command to execute'),
    '--verbose': arg.flag().desc('if set, output extra information to stderr'),
    // aliases
    '-c': '--command',
    '-v': '--verbose',
  })
  .desc('Execute 3 possible commands')
  .ex(['-c date', '-c uptime --verbose'])
  .parse();

if (args.get('--verbose')) {
  std.err.puts(`Executing ${args.get('--command')}...\n`);
}

const handleCommandDate = async () => {
  const output = await exec(['date', '+%Y-%m-%d %H:%M:%S']);
  const [date, time] = output.split(' ');
  const table = gum.renderTable(['Date', 'Time'], [[date, time]], {
    border: gum.Border.NORMAL,
    custom: {
      env: {
        GUM_TABLE_BORDER_FOREGROUND: 212,
      },
    },
  });
  std.out.puts(`${table}\n`);
};

const handleCommandUptime = async () => {
  const output = await exec('uptime');
  std.out.puts(
    `Uptime is ${gum.style(output, {
      foreground: 212,
    })}\n`
  );
};

const handleCommandMarkdown = () => {
  const markdown = `
# This is Markdown

- hello
- world
  `.trim();
  std.out.puts(
    `${gum.format(markdown, {
      type: gum.FormatType.MARKDOWN,
    })}\n`
  );
};

switch (args.get('--command')) {
  case 'date':
    await handleCommandDate();
    break;
  case 'uptime':
    await handleCommandUptime();
    break;
  case 'markdown':
    handleCommandMarkdown();
    break;
}
