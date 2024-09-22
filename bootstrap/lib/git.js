/** @format */
// @ts-check

import { execSync } from '../ext/process.js';

/**
 * @returns {boolean}
 */
export const hasGit = () => {
  try {
    execSync('git --version', {
      passStderr: false,
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * @param {string} path
 *
 * @returns {boolean}
 */
export const isRepo = (path) => {
  try {
    execSync('git status', {
      cwd: path,
      passStderr: false,
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * @param {string} path
 */
export const initRepo = (path) => {
  try {
    execSync('git init', {
      cwd: path,
      passStderr: false,
    });
  } catch (e) {
    throw new Error(`Could not initialize git repository (${e.message})`);
  }
};

/**
 * @param {string} path
 *
 * @returns  {string}
 */
export const getRoot = (path) => {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: path,
      passStderr: false,
    });
  } catch (e) {
    throw new Error(`Could not get repository root (${e.message})`);
  }
};

/**
 * @param {string} repoRoot
 * @param {string[]} entries
 */
export const addEntries = (repoRoot, entries) => {
  try {
    execSync(['git', 'add', ...entries], {
      cwd: repoRoot,
      passStderr: false,
    });
  } catch (e) {
    throw new Error(`Could not add entries to repository (${e.message})`);
  }
};
