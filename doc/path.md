<!-- omit in toc -->
# path

This module provides utilities for working with file and directory paths. It tries to mimic the behaviour of the _Node.js_ `path` module.

- [getScriptDir(...)](#getscriptdir)
- [getScriptName(...)](#getscriptname)
- [getHomeDir(...)](#gethomedir)
- [getTmpDir(...)](#gettmpdir)
- [basename(...)](#basename)
- [dirname(...)](#dirname)
- [extname(...)](#extname)
- [format(...)](#format)
- [parse(...)](#parse)
- [isAbsolute(...)](#isabsolute)
- [join(...)](#join)
- [normalize(...)](#normalize)
- [resolve(...)](#resolve)
- [relative(...)](#relative)
- [toNamespacedPath(...)](#tonamespacedpath)

## getScriptDir(...)

`getScriptDir()`

Returns the directory of the currently executing script.

**returns** *string*

<u>Example</u>

```js
const value = path.getScriptDir();
```

## getScriptName(...)

`getScriptName(withoutExt)`

Retrieves the name of the currently executing script, optionally without its file extension.

* withoutExt (*boolean*) : if `true`, returns the script name without the extension (default = `false`)

**returns** *string*

<u>Example</u>

```js
const value = path.getScriptName();
```

## getHomeDir(...)

`getHomeDir()`

Returns the home directory of the current user.

**returns** *string*

<u>Example</u>

```js
const value = path.getHomeDir();
```

## getTmpDir(...)

`getTmpDir()`

Returns the path to the temporary directory.

**returns** *string*

<u>Example</u>

```js
const value = path.getTmpDir();
```

## basename(...)

`basename(path, suffix)`

The `path.basename()` method returns the last portion of a path, similar to the _Unix_ `basename` command.
- trailing directory separators are ignored

* **path** (*string*)
* suffix (*string*) : an optional suffix to remove

**returns** *string*

<u>Example</u>

```js
console.log(path.basename('/foo/bar/baz/asdf/quux.html'));
console.log(path.basename('/foo/bar/baz/asdf/quux.html', 'html'));
```

## dirname(...)

`dirname(path)`

The `path.dirname()` method returns the directory name of a path, similar to the _Unix_ `dirname` command.
- trailing directory separators are ignored

* **path** (*string*)

**returns** *string*

<u>Example</u>

```js
console.log(path.dirname('/foo/bar/baz/asdf/quux'));
```

## extname(...)

`extname(path)`

The `path.extname()` method returns the extension of the path, from the last occurrence of the `.` (period) character to the end of the string in the last portion of the path.

- If there is no `.` in the last portion of the path, or if there are no `.` characters other than the first character of the basename of `path`, an empty string is returned.

* **path** (*string*)

**returns** *string*

<u>Example</u>

```js
console.log(path.extname('index.coffee.md'));
console.log(path.extname('index.'));
```

## format(...)

`format(pathObject)`

The `path.format()` method returns a path string from an `object`. This is the opposite of `path.parse()`.

- `pathObject.root` is ignored if `pathObject.dir` is provided.
- `pathObject.ext` and `pathObject.name` are ignored if `pathObject.base` exists.
- If only `pathObject.root` is provided or `pathObject.dir` is equal to `pathObject.root`, the platform separator will not be included.

```js
/**
 * @typedef {Object} PathObject
 * @property {string} dir
 * @property {string} root
 * @property {string} base
 * @property {string} name
 * @property {string} ext
 */
```

* **pathObject** (*Partial<PathObject>*)

**returns** *string*

<u>Example</u>

```js
console.log(
  path.format({
    root: '/ignored',
    dir: '/home/user/dir',
    base: 'file.txt',
  })
);
```

## parse(...)

`parse(path)`

The `path.parse()` method returns an `object` whose properties represent significant elements of the path.

- trailing directory separators are ignored

```js
/**
 * @typedef {Object} PathObject
 * @property {string} dir
 * @property {string} root
 * @property {string} base
 * @property {string} name
 * @property {string} ext
 */
```

* **path** (*string*)

**returns** *PathObject*

<u>Example</u>

```js
console.log(JSON.stringify(path.parse('/home/user/dir/file.txt'), null, 2));
```

## isAbsolute(...)

`isAbsolute(path)`

The `path.isAbsolute()` method determines if `path` is an absolute path.

* **path** (*string*)

**returns** *boolean*

<u>Example</u>

```js
console.log(path.isAbsolute('/foo/bar')); // true
console.log(path.isAbsolute('qux/')); // false
```

## join(...)

`join(...paths)`

The `path.join()` method joins all given path segments together using the platform-specific separator as a delimiter, then normalizes the resulting path.

- Zero-length path segments are ignored.
- If the joined path string is a zero-length string, then `.` will be returned, representing the current working directory.

* **paths** (*string[]*)

**returns** *string*

<u>Example</u>

```js
console.log(path.join('/foo', 'bar', 'baz/asdf', 'quux', '..'));
```

## normalize(...)

`normalize(path)`

The `path.normalize()` method normalizes the given path, resolving `..` and `.` segments.

- When multiple, sequential path segment separation characters are found, they are replaced by a single instance of the platform-specific path segment separator.
- Trailing separators are preserved.
- If the `path` is a zero-length string, `.` is returned, representing the current working directory.

* **path** (*string*)

**returns** *string*

<u>Example</u>

```js
console.log(path.normalize('/foo/bar//baz/asdf/quux/..')); // '/foo/bar/baz/asdf'
```

## resolve(...)

`resolve(...paths)`

The `path.resolve()` method resolves a sequence of paths or path segments into an absolute path.

- The given sequence of paths is processed from right to left, with each subsequent path prepended until an absolute path is constructed.
- If, after processing all given path segments, an absolute path has not yet been generated, the current working directory is used.
- The resulting path is normalized, and trailing slashes are removed unless the path is resolved to the root directory.

* **paths** (*string[]*)

**returns** *string*

<u>Example</u>

```js
console.log(path.resolve('/foo/bar', './baz')); // '/foo/bar/baz'
/*
  If the current working directory is /home/myself/node
  this returns '/home/myself/node/wwwroot/static_files/gif/image.gif'
 */
console.log(path.resolve('wwwroot', 'static_files/png/', '../gif/image.gif'));
```

## relative(...)

`relative(from, to)`

The `path.relative()` method returns the relative path from `from` to `to` based on the current working directory.

- If `from` and `to` each resolve to the same path (after calling `path.resolve()` on each), a zero-length string is returned.
- If a zero-length string is passed as `from` or `to`, the current working directory will be used instead.

* **from** (*string*)
* **to** (*string*)

**returns** *string*

<u>Example</u>

```js
console.log(path.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb')); // '../../impl/bbb'
/*
  If the current working directory is /home/myself/node
  this returns '../home/myself/node'
 */
console.log(path.relative('/foo', '/home/myself/node'));
```

## toNamespacedPath(...)

`toNamespacedPath(path)`

This method is meaningful only on _Windows_ systems. On _POSIX_ systems, the method is non-operational and always returns `path` without modifications.

* **path** (*string*)

**returns** *string*

