A set of pure JS extensions for [QuickJS](https://github.com/ctn-malone/quickjs-cross-compiler)

* parse command line arguments and build static command line utilities using JS (see [doc](https://github.com/vercel/arg/tree/5.0.0))
* execute external processes asynchronously (see [doc](doc/process.md))
* setInterval / clearInterval / wait functions (see [doc](doc/timers.md))
* *curl* wrapper supporting all HTTP methods and most of *curl* options (see [doc](doc/curl.md))
* *ssh* wrapper (for quick-and-dirty remote scripting without [ansible](https://github.com/ansible/ansible)) (see [doc](doc/ssh.md))
* minimal unit testing library (see [doc](doc/tester.md))
* semver versions comparison (see [doc](doc/version.md))
* interact with [pass](https://www.passwordstore.org/) (see [doc](doc/password-store.md))
* build glamorous shell scripts using [gum](https://github.com/charmbracelet/gum) (see [doc](doc/gum.md))

# Rational

I'm focused on building static binaries targeting linux command line. This library is an intent at providing just enough to make creating static adhoc scripts easier on linux

# Nix

In order to get a shell with the static interpreter (`qjs.sh`) and compiler (`qjsc.sh`), as well as this library, run following command

```
nix develop github:ctn-malone/qjs-ext-lib
```

Following commands can also be used to run `qjs.sh` or `qjsc.sh` using `nix run`

- run `qjs.sh`

```
nix run github:ctn-malone/qjs-ext-lib#qjs
```

- run `qjsc.sh`

```
nix run github:ctn-malone/qjs-ext-lib#qjsc
```

Inside the Nix shell, any `.js` file from the library can be imported from an `ext` directory

```js
import { curlRequest } from 'ext/curl.js';

/*
    Perform a POST request to https://jsonplaceholder.typicode.com/posts and print response payload
 */

const main = async () => {
    const body = await curlRequest('https://jsonplaceholder.typicode.com/posts', {
        method:'post',
        json: {
            title: 'foo',
            body: 'bar',
            userId: 1
        }
    });
    console.log(JSON.stringify(body, null, 4));
}

main();
```

# Examples

## Execute external processes

```js
import { exec } from '../../src/process.js';

/*
    Run 3 external commands in parallel 
 */

const main = async () => {
    const commands = [
        'date',
        'uptime',
        'which sh'
    ];
    const promises = [];
    commands.forEach(c => promises.push(exec(c)));
    (await Promise.all(promises)).forEach((output, i) => {
        console.log(`${commands[i]} => ${output}`);
    });
}

main();
```

See more [examples](examples/process)

## Perform REST calls

```js
import { curlRequest } from '../../src/curl.js';

/*
    Perform a POST request to https://jsonplaceholder.typicode.com/posts and print response payload
 */

const main = async () => {
    const body = await curlRequest('https://jsonplaceholder.typicode.com/posts', {
        method:'post',
        json: {
            title: 'foo',
            body: 'bar',
            userId: 1
        }
    });
    console.log(JSON.stringify(body, null, 4));
}

main();
```

See more [examples](examples/curl)

## Execute remote command through SSH

```js
import { Ssh } from 'ext/ssh.js';
import * as std from 'std';

const main = async () => {
    /* 
        Setup local port forwarding for 30s
        - 127.0.0.1:10000 => test:10000
        - 127.0.0.1:10001 => test:20001
    */
    const ssh = new Ssh(`root@test:2222`, 'sleep 30', {
        localForward:[
            {remotePort:10000},
            {remotePort:20001, localPort:10001}
        ]
    });
    const p = ssh.run();
    const success = await ssh.waitForSessionSetup();
    await p;
}

main();
```

See more [examples](examples/ssh)

## Build CLI tools

```js
import * as gum from 'ext/gum.js';

while (true) {
  const expectedNumber = (Math.floor(Math.random() * 5) + 1).toString();
  const item = gum.chooseItemFromList(
    [1, 2, 3, 4, 5].map((e) => e.toString()),
    {
      header: 'Please try to guess my number',
      cursor: '-> ',
    }
  );
  if (!item) {
    break;
  }
  let message =
    item.value === expectedNumber.toString()
      ? gum.style('Correct !', { foreground: '#00ff00' })
      : gum.style('Wrong !', { foreground: '#ff0000' });
  console.log(
    `${message} The number was ${gum.style(expectedNumber, { bold: true })}`
  );
  if (!gum.confirm({ prompt: 'Do you want to play again ?' })) {
    break;
  }
}
console.log('Goodbye !');
```

![Example](img/gum-readme.gif)

See more [examples](examples/gum)

# Run unit tests

Run `run.js` under `test` directory

```
qjs run.js
```

<u>NB</u>: some tests will be skipped unless specific environment variables are defined

* ssh : by default, no real SSH connection will be made from unit tests. Following environment variables can be defined to change behaviour
  * QJS_EXT_LIB_TEST_SSH_REAL_CONNECT : if set to `1`, SSH connections will be made to localhost to execute scripts located under `test/data` (ensure that current user is allowed to SSH to localhost using default SSH key)
  * QJS_EXT_LIB_TEST_SSH_REAL_LOCAL_FORWARD : if set to `1`, real local SSH forward will be tested (will be ignored if `QJS_EXT_TEST_SSH_REAL_CONNECT` != `1`)
  * QJS_EXT_LIB_TEST_SSH_REAL_REMOTE_FORWARD : if set to `1`, real remote SSH forward will be tested (will be ignored if `QJS_EXT_TEST_SSH_REAL_CONNECT` != `1`)