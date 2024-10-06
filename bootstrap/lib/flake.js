/** @format */
// @ts-check

import * as std from '../ext/std.js';
import { writeFile } from './utils.js';
import { execSync } from '../ext/process.js';

export const MAIN_FLAKE_FILE_NAME = 'flake.nix';
export const MAIN_FLAKE_LOCK_FILE_NAME = 'flake.lock';
export const QEL_FLAKE_FILE_NAME = 'qel.nix';

/**
 * @param {string} flakePath
 * @param {string} templatePath
 * @param {string} flakeDescription
 */
export const createMainFlake = (flakePath, templatePath, flakeDescription) => {
  /** @type {Object | undefined} */
  let errObj = undefined;

  const templateFile = std.open(templatePath, 'r', errObj);
  if (errObj !== undefined) {
    throw new Error(
      `Could not open '${templatePath}' for reading (${std.strerror(
        errObj.errno
      )})`
    );
  }
  const template = /** @type {std.StdFile} */ (templateFile)
    .readAsString()
    .replace('@flake_description@', flakeDescription);
  /** @type {std.StdFile} */ (templateFile).close();

  writeFile(flakePath, template);
};

/**
 * @param {string} dirPath
 *
 * @returns {string}
 */
export const getMainFlakePath = (dirPath) => {
  return `${dirPath}/${MAIN_FLAKE_FILE_NAME}`;
};

/**
 * @param {string} dirPath
 */
export const ensureMainFlakeLock = (dirPath) => {
  try {
    execSync(['nix', 'flake', 'lock'], {
      cwd: dirPath,
      passStderr: false,
    });
  } catch (e) {
    throw new Error(`Could not create/update lock file (${e.message})`);
  }
};

/**
 * @param {string} dirPath
 *
 * @returns {string}
 */
export const getMainFlakeLockPath = (dirPath) => {
  return `${dirPath}/${MAIN_FLAKE_LOCK_FILE_NAME}`;
};

/**
 * @param {string} flakePath
 * @param {string} templatePath
 */
export const createQelFlake = (flakePath, templatePath) => {
  /** @type {Object | undefined} */
  let errObj = undefined;

  const templateFile = std.open(templatePath, 'r', errObj);
  if (errObj !== undefined) {
    throw new Error(
      `Could not open '${templatePath}' for reading (${std.strerror(
        errObj.errno
      )})`
    );
  }
  const template = /** @type {std.StdFile} */ (templateFile).readAsString();
  /** @type {std.StdFile} */ (templateFile).close();

  writeFile(flakePath, template);
};

/**
 * @param {string} dirPath
 *
 * @returns {string}
 */
export const getQelFlakePath = (dirPath) => {
  return `${dirPath}/${QEL_FLAKE_FILE_NAME}`;
};
