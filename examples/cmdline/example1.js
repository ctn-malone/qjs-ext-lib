/** @format */
// @ts-check

import arg from '../../src/arg.js';
import { exec } from '../../src/process.js';

/*
  Simple CLI example
 */

const COMMANDS = ['date', 'uptime'];

const args = arg
  .parser({
    '--command': arg.str().req().enum(COMMANDS).desc('command to run'),
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
