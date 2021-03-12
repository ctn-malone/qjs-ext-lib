A set of pure JS extensions for [QuickJS](https://github.com/ctn-malone/quickjs-cross-compiler)

* parse command line arguments and build static command line utilities using JS (see [doc](https://github.com/vercel/arg/tree/5.0.0))
* execute external processes asynchronously (see [doc](doc/process.md))
* setInterval / clearInterval / wait functions (see [doc](doc/timers.md))
* *curl* wrapper supporting all HTTP methods and most of *curl* options (see [doc](doc/curl.md))
* minimal unit testing library (see [doc](doc/tester.md))
* semver versions comparison (see [doc](doc/version.md))

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

# Run unit tests

Run `run.js` under `test` directory

```
qjs run.js
```