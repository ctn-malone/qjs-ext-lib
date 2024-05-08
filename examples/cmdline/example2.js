/** @format */
// @ts-check

import arg from '../../src/arg.js';
import { exec } from '../../src/process.js';

/*
  Simple CLI example with default argument and support for environment variable
 */

const COMMANDS = ['date', 'uptime'];
const DEFAULT_COMMAND = 'date';

const args = arg
  .parser({
    '--command': arg
      .str(DEFAULT_COMMAND)
      .req()
      .enum(COMMANDS)
      .desc('command to run')
      .env('CMD'),
    '--verbose': arg.flag(),
    // aliases
    '-c': '--command',
    '-v': '--verbose',
  })
  .parse();

if (args['--verbose']) {
  console.log(`Will run command '${args['--command']}'`);
}
exec(args['--command']).then((output) => {
  console.log(output);
});
