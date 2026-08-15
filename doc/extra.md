<!-- omit in toc -->
# extra

Higher-level helpers around the [extra functions](https://github.com/ctn-malone/quickjs-cross-compiler#extra-functions) from _quickjs-cross-compiler_, with binary fallbacks when they are unavailable

- [withExclusiveLock(...)](#withexclusivelock)
- [mktemp(...)](#mktemp)
- [mkdtemp(...)](#mkdtemp)

## withExclusiveLock(...)

Run a promise while holding an exclusive advisory lock on a file.
Uses `os.flock` when available, otherwise falls back to the `flock` binary.

`withExclusiveLock(filepath, callback)`

* **filepath** (*string*) : lock file path (created if it does not exist)
* **callback** (*function*) : async function to run while the lock is held

**return** *Promise<T>* result of `callback`

<u>Example</u>

```js
import * as extra from 'ext/extra.js';

await extra.withExclusiveLock('/tmp/my.lock', async () => {
  // critical section
});
```

## mktemp(...)

Create a unique temporary file.
Uses `os.mkstemp` when available, otherwise falls back to the `mktemp` binary.
The file is created empty and closed; only its path is returned.

`mktemp(options)`

* options (*object*) : options
  - options.directory (*string*) : parent directory for the temporary file (default = result of `path.getTmpDir()`)

**return** *string* path to the temporary file

<u>Example</u>

```js
import * as extra from 'ext/extra.js';

const filepath = extra.mktemp();
console.log(filepath);

const customFilepath = extra.mktemp({ directory: '/var/tmp' });
console.log(customFilepath);
```

## mkdtemp(...)

Create a unique temporary directory.
Uses `os.mkdtemp` when available, otherwise falls back to the `mktemp` binary.

`mkdtemp(options)`

* options (*object*) : options
  * options.directory (*string*) : parent directory for the temporary directory (default = result of `path.getTmpDir()`)

**return** *string* path to the temporary directory

<u>Example</u>

```js
import * as extra from 'ext/extra.js';

const dirpath = extra.mkdtemp();
console.log(dirpath);

const customDirpath = extra.mkdtemp({ directory: '/var/tmp' });
console.log(customDirpath);
```
