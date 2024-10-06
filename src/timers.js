/** @format */
// @ts-check
'use strict;';

/*
  setInterval / clearInterval implementation
 */

import * as os from './os.js';

const timers = new Map();

/**
 * Async wait function
 *
 * @param {number} delay - delay in ms
 *
 * @returns {Promise<void>}
 */
const wait = (delay) => {
  return new Promise((resolve) => {
    os.setTimeout(() => {
      return resolve();
    }, delay);
  });
};

/**
 * setInterval function
 *
 * @param {function} cb
 * @param {number} interval - interval in ms
 *
 * @returns {object} timer handle
 */
const setInterval = (cb, interval) => {
  const timer = {};
  const state = { enabled: true };
  timers.set(timer, state);
  const fn = () => {
    os.setTimeout(() => {
      if (!state.enabled) {
        return;
      }
      cb();
      fn();
    }, interval);
  };
  fn();
  return timer;
};

/**
 * clearInterval function
 *
 * @param {object} timer - timer
 *
 * @returns {boolean} {true} if timer was found, {false} otherwise
 */
const clearInterval = (timer) => {
  const state = timers.get(timer);
  if (undefined === state) {
    return false;
  }
  state.enabled = false;
  timers.delete(timer);
  return true;
};

export { wait, setInterval, clearInterval };
