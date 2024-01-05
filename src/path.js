/** @format */
// @ts-check
'use strict;';

// @ts-ignore
import * as std from 'std';
// @ts-ignore
import * as os from 'os';

/**
 * @returns {string}
 */
const getScriptDir = () => {
  // @ts-ignore
  const arr = scriptArgs[0].split('/');
  // only a single entry (ie: we're in the same directory) => return cwd
  if (1 === arr.length) {
    // @ts-ignore
    return os.getcwd()[0];
  }
  // remove last entry
  arr.pop();
  return arr.join('/');
};

/**
 * @param {boolean} [withoutExt=false]
 *
 * @returns {string}
 */
const getScriptName = (withoutExt) => {
  if (undefined === withoutExt) {
    withoutExt = false;
  }
  // @ts-ignore
  let arr = scriptArgs[0].split('/');
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
const getHomeDir = () => {
  return std.getenv('HOME');
};

export { getScriptDir, getScriptName, getHomeDir };
