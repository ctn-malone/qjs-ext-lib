/** @format */
// @ts-check

import * as std from './std.js';
import * as os from './os.js';

/**
 * Retrieve the directory of the currently executing script
 *
 * @returns {string}
 */
export const getScriptDir = () => {
  /*
    Try using /proc in case we're running a compiled script
   */
  const pid = os.getpid();
  const [procScriptPath, errno] = os.readlink(`/proc/${pid}/exe`);
  if (errno === 0) {
    const scriptName = getScriptName(false);
    const obj = parse(procScriptPath);
    if (scriptName === obj.base) {
      return obj.dir;
    }
  }
  // fallback to scriptArgs
  // @ts-ignore
  const scriptPath = resolve(scriptArgs[0]);
  return dirname(scriptPath);
};

/**
 * Retrieve the name of the currently executing script, optionally without its file extension
 *
 * @param {boolean} [withoutExt=false]
 *
 * @returns {string}
 */
export const getScriptName = (withoutExt) => {
  if (undefined === withoutExt) {
    withoutExt = false;
  }
  // @ts-ignore
  let arr = scriptArgs[0].split(sep);
  let script = arr.pop();
  if (!withoutExt) {
    return script;
  }
  arr = script.split('.');
  if (1 == arr.length) {
    return script;
  }
  return arr.slice(0, -1).join('.');
};

/**
 * @returns {string}
 */
export const getHomeDir = () => {
  return /** @type {string} */ (std.getenv('HOME'));
};

/**
 * @returns  {string}
 */
export const getTmpDir = () => {
  let path = std.getenv('TMPDIR');
  if (!path) {
    path = '/tmp';
  }
  return path;
};

/*
  Below functions are meant to mimic some of the functions in Node.js "path" module
  See https://nodejs.org/api/path.html
 */

/**
 * Provides the platform-specific path segment separator.
 * Since we're targetting _POSIX_, it will always be `/`
 *
 * @type {'/'}
 */
export const sep = '/';

/**
 * Provides the platform-specific path delimiter.
 * Since we're targetting _POSIX_, it will always be `:`
 *
 * @type {':'}
 */
export const delimiter = ':';

/**
 * The `path.basename()` method returns the last portion of a path, similar to the _Unix_ `basename` command
 *
 * - trailing directory separators are ignored
 *
 * @param {string} path
 * @param {string} [suffix] - an optional suffix to remove
 *
 * @returns {string}
 * @throws {TypeError} if `path` is not a `string`
 */
export const basename = (path, suffix) => {
  if (typeof path !== 'string') {
    throw new TypeError(
      `The 'path' argument must be a string. Received an instance of ${typeof path}`
    );
  }
  if (!path || path === sep) {
    return '';
  }
  const parts = path.split(sep);
  let name = '';
  while (parts.length) {
    name = /** @type {string} */ (parts.pop());
    if (name) {
      break;
    }
  }
  if (!name) {
    return '';
  }
  if (!suffix) {
    return name;
  }
  const pos = name.indexOf(suffix);
  if (pos === -1) {
    return name;
  }
  return name.substring(0, pos);
};

/**
 * The `path.dirname()` method returns the directory name of a path, similar to the _Unix_ `dirname` command
 *
 * - trailing directory separators are ignored
 *
 * @param {string} path
 *
 * @returns {string}
 * @throws {TypeError} if `path` is not a `string`
 */
export const dirname = (path) => {
  if (typeof path !== 'string') {
    throw new TypeError(
      `The 'path' argument must be a string. Received an instance of ${typeof path}`
    );
  }
  if (!path) {
    return '.';
  }
  if (path === sep) {
    return sep;
  }
  const parts = path.split(sep);
  while (parts.pop() === '' && parts.length > 1);
  if (!parts.length) {
    return '.';
  }
  if (parts.length === 1) {
    if (!parts[0]) {
      return sep;
    }
    return parts[0];
  }
  return parts.join(sep);
};

/**
 * The `path.extname()` method returns the extension of the path, from the last occurrence of the `.` (period)
 * character to end of string in the last portion of the path.
 *
 * If there is no `.` in the last portion of the path, or if there are no `.` characters other than
 * the first character of the basename of `path`, an empty string is returned.
 *
 * @param {string} path
 *
 * @returns {string}
 * @throws {TypeError} if `path` is not a string
 */
export const extname = (path) => {
  const name = basename(path);
  const pos = name.lastIndexOf('.');
  if (pos === -1 || pos === 0) {
    return '';
  }
  return name.substring(pos);
};

/**
 * @typedef {Object} PathObject
 * @property {string} dir
 * @property {string} root
 * @property {string} base
 * @property {string} name
 * @property {string} ext
 */

/**
 * The `path.format()` method returns a path string from an `object`. This is the opposite of `path.parse()`
 *
 * When providing properties to the `pathObject` remember that there are combinations where one property
 * has priority over another:
 *
 * - `pathObject.root` is ignored if `pathObject.dir` is provided
 * - `pathObject.ext` and `pathObject.name` are ignored if `pathObject.base` exists
 * - if only `pathObject.root` is provided or `pathObject.dir` is equal to `pathObject.root`
 *   the platform separator will not be included
 *
 * @param {Partial<PathObject>} pathObject
 *
 * @returns {string}
 */
export const format = (pathObject) => {
  let path = '';
  if (pathObject.dir) {
    path = pathObject.dir;
    if (pathObject.dir !== pathObject.root) {
      path += sep;
    }
  } else {
    if (pathObject.root) {
      path = pathObject.root;
    }
  }
  if (pathObject.base) {
    path += pathObject.base;
  } else {
    if (pathObject.name) {
      path += pathObject.name;
    }
    if (pathObject.ext) {
      if (pathObject.ext.startsWith('.')) {
        path += pathObject.ext;
      } else {
        path += `.${pathObject.ext}`;
      }
    }
  }
  return path;
};

/**
 * The `path.parse()` method returns an `object` whose properties represent significant elements of the path
 *
 * - trailing directory separators are ignored
 *
 * @param {string} path
 *
 * @returns {PathObject}
 * @throws {TypeError} if `path` is not a string
 */
export const parse = (path) => {
  const obj = { dir: '', root: '', base: '', name: '', ext: '' };
  if (!path) {
    return obj;
  }
  const base = basename(path);
  if (base) {
    obj.base = base;
    const pos = base.lastIndexOf('.');
    if (pos === -1) {
      obj.name = base;
    } else {
      obj.name = base.substring(0, pos);
      obj.ext = base.substring(pos);
    }
  }
  const dir = dirname(path);
  if (dir === '.') {
    obj.dir = dir;
  } else {
    obj.dir = dir;
    if (dir.startsWith(sep)) {
      obj.root = sep;
    }
  }
  return obj;
};

/**
 * The `path.isAbsolute()` method determines if `path` is an absolute path
 *
 * @param {string} path
 *
 * @returns {boolean}
 * @throws {TypeError} if `path` is not a `string`
 */
export const isAbsolute = (path) => {
  if (typeof path !== 'string') {
    throw new TypeError(
      `The 'path' argument must be a string. Received an instance of ${typeof path}`
    );
  }
  if (!path || path === '.') {
    return false;
  }
  return path.startsWith(sep);
};

/**
 * The `path.join()` method joins all given path segments together using the platform-specific
 * separator as a delimiter, then normalizes the resulting path
 *
 * - zero-length path segments are ignored
 * - if the joined path string is a zero-length string
 *   then `.` will be returned, representing the current working directory
 *
 * @param  {string[]} paths
 *
 * @returns {string}
 * @throws {TypeError} if any of the path segments is not a `string`
 */
export const join = (...paths) => {
  for (const path of paths) {
    if (typeof path !== 'string') {
      throw new TypeError(
        `All 'paths' segments must be strings. Received an instance of ${typeof path}`
      );
    }
  }
  const path = paths.join(sep);
  if (!path) {
    return '.';
  }
  return normalize(path);
};

/**
 * The `path.normalize()` method normalizes the given path, resolving `..` and `.` segments
 *
 * - when multiple, sequential path segment separation characters are found, they are replaced by
 *   a single instance of the platform-specific path segment separator
 * - trailing separators are preserved
 * - if the `path` is a zero-length string, `.` is returned, representing the current working directory
 *
 * @param {string} path
 *
 * @returns {string}
 * @throws {TypeError} if `path` is not a `string`
 */
export const normalize = (path) => {
  const isAbsolutePath = isAbsolute(path);
  if (!path || path === '.') {
    return '.';
  }

  const parts = path.split(sep).filter((part) => part);
  /** @type {string[]} */
  const stack = [];

  // number of parts we can pop from stack
  let popCount = 0;
  for (const part of parts) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      if (popCount) {
        stack.pop();
        --popCount;
        continue;
      }
      if (isAbsolutePath) {
        continue;
      }
    } else {
      ++popCount;
    }
    stack.push(part);
  }

  // handle absolute path
  let normalizedPath = `${isAbsolutePath ? sep : ''}${stack.join(sep)}`;
  // root path
  if (normalizedPath === sep) {
    return normalizedPath;
  }

  // zero-length string
  if (!normalizedPath) {
    return '.';
  }

  // preserve trailing separator
  if (path.endsWith(sep)) {
    normalizedPath += sep;
  }
  return normalizedPath;
};

/**
 * The `path.resolve()` method resolves a sequence of paths or path segments into an absolute path.
 *
 * The given sequence of paths is processed from right to left, with each subsequent path prepended
 * until an absolute path is constructed
 *
 * For instance, calling `path.resolve('/foo', '/bar', 'baz')` would return `/bar/baz`
 * because `baz` is not an absolute path but `'/bar' + '/' + 'baz'` is
 *
 * If, after processing all given path segments, an absolute path has not yet been generated,
 * the current working directory is used
 *
 * The resulting path is normalized and trailing slashes are removed unless the path is resolved
 * to the root directory
 *
 * @param  {string[]} paths
 *
 * @returns {string}
 * @throws {TypeError} if any of the path segments is not a `string`
 */
export const resolve = (...paths) => {
  for (const path of paths) {
    if (typeof path !== 'string') {
      throw new TypeError(
        `All 'paths' segments must be strings. Received an instance of ${typeof path}`
      );
    }
  }
  /** @type {string[]} */
  const parts = [];
  for (let i = paths.length - 1; i >= 0; --i) {
    parts.unshift(paths[i]);
    if (parts[0].startsWith(sep)) {
      break;
    }
  }

  // not an absolute path, prepend current directory
  if (!parts[0].startsWith(sep)) {
    const [cwd, errno] = os.getcwd();
    if (errno) {
      const err = std.strerror(errno);
      throw new Error(`Could not retrieve current directory (${err})`, {
        cause: { code: errno, error: err },
      });
    }
    parts.unshift(cwd);
  }

  let path = parts.join(sep);
  path = normalize(path);

  // remove trailing separators
  if (path.endsWith(sep) && path !== sep) {
    path = path.substring(0, path.length - 1);
  }

  return path;
};

/**
 * The `path.relative()` method returns the relative path from `from` to `to`
 * based on the current working directory
 *
 * If `from` and `to` each resolve to the same path (after calling `path.resolve()` on each),
 * a zero-length string is returned
 *
 * If a zero-length string is passed as `from` or `to`, the current working directory
 * will be used instead of the zero-length strings.
 *
 * @param {string} from
 * @param {string} to
 *
 * @returns {string}
 * @throws {TypeError} if `from` or `to` is not a `string`
 */
export const relative = (from, to) => {
  if (typeof from !== 'string') {
    throw new TypeError(
      `The "from" argument must be a string. Received an instance of ${typeof from}`
    );
  }
  if (typeof to !== 'string') {
    throw new TypeError(
      `The "to" argument must be a string. Received an instance of ${typeof to}`
    );
  }

  // convert to absolute paths
  from = resolve(from);
  to = resolve(to);
  if (from === to) {
    return '';
  }

  const fromParts = from.split(sep);
  const toParts = to.split(sep);

  // find the common parts
  let i = 0;
  while (
    i < fromParts.length &&
    i < toParts.length &&
    fromParts[i] === toParts[i]
  ) {
    ++i;
  }

  // number of '..' needed to go back to the last common part
  const relativeParts = fromParts.slice(i).map(() => '..');

  // add the extra parts for "to"
  for (let j = i; j < toParts.length; ++j) {
    relativeParts.push(toParts[j]);
  }

  return relativeParts.join(sep);
};

/**
 * This method is meaningful only on _Windows_ systems.
 * On _POSIX_ systems, the method is non-operational and always returns `path` without modifications.
 *
 * @param {string} path
 *
 * @returns {string}
 */
export const toNamespacedPath = (path) => {
  return path;
};

const nodeJsExports = {
  delimiter,
  sep,
  basename,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
  toNamespacedPath,
};

export const posix = nodeJsExports;
