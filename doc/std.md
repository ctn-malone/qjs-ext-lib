<!-- omit in toc -->
# std

Only the custom functions provided by this library are documented here. For the standard ones, see https://bellard.org/quickjs/quickjs.html#std-module

## onExit(...)

Can be used to add a callback which will be executed when `std.exit` is called. This is similar to `trap "xxx" EXIT` in `bash`

`onExit(cb)`

* **cb** (*() => void*) : callback to execute when `std.exit` is called

In case multiple callbacks have been added, they will be executed in the order they were added. If one callback triggers an error, the remaining callbacks won't be run and and application will exit with an error (_exit code_ = `1`)

Default handlers for common termination signals (such as SIGTERM and SIGINT) are installed automatically, ensuring that the callbacks are executed when one of these signals is received.

<u>NB</u>: if the program craches because of an **unhandled exception**, **no callbacks** will be called.

<u>Example</u>

```js
import * as std from 'ext/std.js';
import * as os from 'ext/os.js';

const LOG_FILE = '/tmp/log.txt';

const cleanup = () => {
  console.log('cleanup');
  os.remove(LOG_FILE);
}

/*
  "cleanup" should be printed twice before exist
 */
std.onExit(cleanup);
std.onExit(cleanup);

const logFile = std.open(LOG_FILE, 'w');
for (let i = 0; i < 10; ++i) {
  logFile.puts(`${i}\n`);
}
logFile.close();

std.exit(0);
```
