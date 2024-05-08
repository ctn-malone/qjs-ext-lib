/** @format */

import { Ssh, multiSsh } from '../../src/ssh.js';

/*
  Check uptime on multiple servers
 */
const main = async () => {
  const hosts = ['test1', 'test2', 'test3'];
  const list = [];
  for (let i = 0; i < 3; ++i) {
    list.push(new Ssh(hosts[i], 'uptime'));
  }
  const responses = (await multiSsh(list)).map((e) => e.ssh.stdout);
  console.log(JSON.stringify(responses, null, 4));
};

main();
