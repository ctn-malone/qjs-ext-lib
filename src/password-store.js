/** @format */
// @ts-check
'use strict;';

/*
  Simple wrappers to interact with pass

  See https://www.passwordstore.org/
 */

import { Process } from './process.js';
import { getHomeDir } from './path.js';

// @ts-ignore
import * as os from 'os';

const PASSWORD_STORE_DIRECTORY = '.password-store';

/**
 * Check whether or not a password exists
 *
 * @param {string} passwordPath - path relative to the password store
 *
 * @returns {boolean} {true} if password exist, {false} otherwise
 */
const checkPassword = (passwordPath) => {
  const home = getHomeDir();
  if (!home) {
    return false;
  }
  const p = `${home}/${PASSWORD_STORE_DIRECTORY}/${passwordPath}.gpg`;
  // @ts-ignore
  const obj = os.stat(p);
  return obj[1] === 0;
};

/**
 * Retrieve a password
 *
 * @param {string} passwordPath - path relative to the password store
 * @param {object} [opt] - options
 * @param {boolean} [opt.json=false] - if {true} password will be JSON parsed (default = {false})
 * @param {number} [opt.lineNumber] - if set, only this line (0 based) will be returned (default = {undefined})
 *                                    Will be ignored if {opt.json} is {true}
 *
 * @returns {Promise<object|string|undefined>}
 */
const getPassword = async (passwordPath, opt) => {
  if (!checkPassword(passwordPath)) {
    return undefined;
  }
  const p = new Process(`pass show "${passwordPath}"`);
  await p.run();
  if (!p.success) {
    return undefined;
  }
  let content = p.stdout;
  if (opt) {
    if (opt.json) {
      try {
        content = JSON.parse(content);
      } catch (e) {
        // do nothing
      }
      return content;
    } else {
      if (opt.lineNumber !== undefined) {
        const lineNumber =
          typeof opt.lineNumber === 'number'
            ? opt.lineNumber
            : parseInt(opt.lineNumber);
        if (!isNaN(lineNumber) && lineNumber > 0) {
          const lines = content.split('\n');
          content = lines[lineNumber];
        }
      }
    }
  }
  return content;
};

export { checkPassword, getPassword };
