/** @format */
// @ts-check

import * as std from '../ext/std.js';
import * as os from '../ext/os.js';

/**
 * @param {number} exitCode
 *
 * @returns {any}
 */
export const abort = (exitCode) => {
  return std.exit(exitCode);
};

/**
 * @param {string} filePath
 *
 * @returns {boolean}
 */
export const checkFile = (filePath) => {
  // @ts-ignore
  const [_, err] = os.stat(filePath);
  return !err;
};

/**
 * @param {string} filePath
 * @param {string} content
 */
export const writeFile = (filePath, content) => {
  /** @type {Object | undefined} */
  let errObj = undefined;

  const file = std.open(filePath, 'w+', errObj);
  if (errObj !== undefined) {
    throw new Error(
      `Could not open '${filePath}' for writing (${std.strerror(errObj.errno)})`
    );
  }
  /** @type {std.StdFile} */ (file).puts(content);
  /** @type {std.StdFile} */ (file).close();
};

/**
 * @param {string} absolutePath
 * @param {string} fromPath
 *
 * @returns {string}
 */
export const getRelativePath = (absolutePath, fromPath) => {
  return absolutePath.startsWith(fromPath)
    ? absolutePath.substring(fromPath.length + 1)
    : absolutePath;
};
