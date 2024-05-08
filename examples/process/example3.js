/** @format */

import { Process } from '../../src/process.js';

/*
  - run a loop which print date every 1s
  - stream output using event listener
  - kill process after 5s
 */

const main = async () => {
  const cmdline = 'while [ 1 ] ; do date ; sleep 1 ; done';
  const p = new Process(cmdline, {
    useShell: true,
    lineBuffered: true,
    timeout: 5,
  });
  p.setEventListener('stdout', (obj) => {
    console.log(`Got ${obj.data}`);
  });
  const state = await p.run();
  console.log(`Process terminated: ${JSON.stringify(state)}`);
};

main();
