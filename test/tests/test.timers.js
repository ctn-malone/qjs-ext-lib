/** @format */

import * as os from 'os';
import { tester } from '../../src/tester.js';
import { wait, setInterval, clearInterval } from '../../src/timers.js';

export default () => {
  tester.test(
    'timers.wait',
    async (done) => {
      const startTs = Date.now();
      await wait(1000);
      const endTs = Date.now();
      const delta = endTs - startTs;
      tester.assert(delta >= 1000, `it should wait =~ 1s (${delta}ms)`);
      done();
    },
    { isAsync: true }
  );

  tester.test(
    'timers.setInterval',
    async (done) => {
      let counter = 0;
      const timer = setInterval(() => {
        ++counter;
      }, 250);
      os.setTimeout(() => {
        clearInterval(timer);
        tester.assert(counter >= 4, `counter should be >= 4 (${counter})`);
        const prevCounter = counter;
        os.setTimeout(() => {
          tester.assert(
            counter == prevCounter,
            `counter should be == ${prevCounter} after clearing interval (${counter})`
          );
          done();
        }, 500);
      }, 1250);
    },
    { isAsync: true }
  );
};
