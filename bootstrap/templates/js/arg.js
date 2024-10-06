/** @format */
// @ts-check

import * as std from './ext/std.js';

import arg from './ext/arg.js';

/*
  Read a json file and pretty print it
 */

const args = arg
  .parser({
    '--input': arg
      .path('-')
      .std()
      .check()
      .read({ json: true })
      .desc('json input file (use - for stdin'),
    '--output': arg
      .path('-')
      .std()
      .checkParent()
      .desc('json output file (use - for stdout)'),
    '--indent': arg.num(2).min(1).desc('json indent'),
    '--quiet': arg
      .flag()
      .desc("if set, don't output anything to stderr, unless an error occurs"),
    // aliases
    '-i': '--input',
    '-o': '--output',
    '-q': '--quiet',
  })
  .desc('Read a json file and pretty print it')
  .ex(['--indent 4', '-o /tmp/out.json -q'])
  .parse();

const formattedContent = JSON.stringify(
  args['--input'],
  null,
  args['--indent']
);

if (args['--output'] === '-') {
  std.out.puts(`${formattedContent}\n`);
} else {
  const file = std.open(args['--output'], 'w');
  /** @type {std.StdFile} */ (file).puts(formattedContent);
  /** @type {std.StdFile} */ (file).close();
  if (!args['--quiet']) {
    std.err.puts(
      `Formatted content successfully written to ${args['--output']}`
    );
  }
}
