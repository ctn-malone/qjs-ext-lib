<!-- omit in toc -->
# os

Only the custom functions provided by this library are documented here. For the standard ones, see https://bellard.org/quickjs/quickjs.html#os-module

- [flock(...)](#flock)
- [mkstemp(...)](#mkstemp)
- [mkdtemp(...)](#mkdtemp)

## flock(...)

Apply an advisory lock on an open file (see https://linux.die.net/man/2/flock)

`flock(fd, operation)`

* **fd** (*number*) : open file descriptor
* **operation** (*number*) : it should be one of the following
  - `os.LOCK_EX` for a blocking request
  - `os.LOCK_EX | os.LOCK_NB` for a non blocking request

**return** *number* (error code)

<u>Examples</u>

```js
import * as os from 'ext/os.js';

const fd = os.open('/tmp/lock', os.O_RDWR | os.O_CREAT, 0o644);
// code will block until no other process is accessing the file
os.flock(fd, os.LOCK_EX);
```

```js
import * as os from 'ext/os.js';

const fd = os.open('/tmp/lock', os.O_RDWR | os.O_CREAT, 0o644);
let num = 0;
while (num = os.flock(fd, os.LOCK_EX | os.LOCK_NB)) {
  os.sleep(100);
}
```

## mkstemp(...)

Generate a unique temporary filename from _template_ (wrapper to the libc _mkstemp_) (see https://man7.org/linux/man-pages/man3/mkstemp.3.html)

`mkstemp(template, outputObj)`

* **template** (*string*) : template which MUST end with `XXXXXX`
* **outputObj** (*{filename: string}*) : object where generated filename will be stored

**return** *number* (open file descriptor or -errno in case of error)

<u>Example</u>

```js
import * as os from 'ext/os.js';

const outputObj = { filename: '' };
// template MUST end with XXXXXX
os.mkstemp('/tmp/XXXXXX', outputObj);
console.log(outputObj);
```

## mkdtemp(...)

Create a unique temporary directory from _template_ (wrapper to the libc _mkdtemp_) (see https://man7.org/linux/man-pages/man3/mkdtemp.3.html)

`mkdtemp(template, errorObj)`

* **template** (*string*) : template which MUST end with `XXXXXX`
* errorObj (*{errno?: number}*) : if defined, set its _errno_ property to the error code or to `0` if no error occured

**return** *string|null* (temporary dirname or `null` on error)

<u>Example</u>

```js
import * as os from 'ext/os.js';

const errObj = {};
// template MUST end with XXXXXX
const dirname = os.mkdtemp('/tmp/XXXXXX', errObj);
console.log(dirname);
```
