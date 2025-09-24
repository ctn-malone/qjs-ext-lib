/** @format */

// @ts-check
'use strict;';

/*
  Helpers to perform versions comparison
  It only supports semver versions x.y.z where x, y & z are integers

  An exception will be thrown in case a non semver version is passed as argument
 */

const VERSION = '0.16.1';

/**
 * Check whether or not a version is in semver format
 *
 * @param {string} v - version to check
 * @param {boolean} [throwException=false] - if {true} an exception will be thrown if version does not match semver format (default = {false})
 *
 * @returns {boolean}
 */
const isSemver = (v, throwException) => {
  if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(\-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/.test(v)
  ) {
    if (true === throwException) {
      let value = v;
      if ('string' != typeof v) {
        value = JSON.stringify(v);
      }
      const err = new TypeError(`${value} is not in semver format`);
      throw err;
    }
    return false;
  }
  return true;
};

/**
 * Reduce a semver version to an number
 *
 * @param {string} v - version to reduce
 *
 * @returns {number} integer representation of the version
 */
const reduce = (v) => {
  const value = v.replace(/[-+].*$/g, '');
  const arr = value.split('.').map((e) => parseInt(e));
  let sum = 0;
  const lastIndex = arr.length - 1;
  for (let i = 0; i < arr.length; ++i) {
    sum += arr[lastIndex - i] * Math.pow(10, i);
  }
  return sum;
};

/**
 * Check whether or not two versions are equal
 *
 * @param {string} target - version to compare to
 * @param {string} current - version to check
 *
 * @returns {boolean}
 */
const eq = (target, current) => {
  return current === target;
};

/**
 * Check whether or not two versions are distinct
 *
 * @param {string} current - version to check
 * @param {string} target - version to compare to
 *
 * @returns {boolean}
 */
const neq = (current, target) => {
  return current !== target;
};

/**
 * Check whether or not a given version is less than a target version
 *
 * @param {string} target - version to compare to
 * @param {string} current - version to check
 *
 * @returns {boolean}
 */
const lt = (target, current) => {
  const _current = reduce(current);
  const _target = reduce(target);
  return _current < _target;
};

/**
 * Check whether or not a given version is at most equal to a target version
 *
 * @param {string} target - version to compare to
 * @param {string} current - version to check
 *
 * @returns {boolean}
 */
const lte = (target, current) => {
  return eq(target, current) || lt(target, current);
};

/**
 * Check whether or not a given version is greater than a target version
 *
 * @param {string} target - version to compare to
 * @param {string} current - version to check
 *
 * @returns {boolean}
 */
const gt = (target, current) => {
  const _current = reduce(current);
  const _target = reduce(target);
  return _current > _target;
};

/**
 * Check whether or not a given version is at least equal to a target version
 *
 * @param {string} target - version to compare to
 * @param {string} current - version to check
 *
 * @returns {boolean}
 */
const gte = (target, current) => {
  return eq(target, current) || gt(target, current);
};

const version = {
  VERSION: VERSION,
  /**
   * Check whether or not a version matches semver
   *
   * @param {string} version - version to check
   *
   * @returns {boolean}
   */
  isSemver: (version) => {
    return isSemver(version, false);
  },
  /**
   * Try to convert to semver
   *
   * @param {string} version - version to convert
   *
   * @returns {string|undefined} will return {undefined} if {version} does not start with x.y.z
   */
  convert: (version) => {
    if (isSemver(version)) {
      return version;
    }
    const matches = version.match(/^([0-9]+\.[0-9]+\.[0-9]+).*$/);
    if (null === matches) {
      return undefined;
    }
    return matches[1];
  },
  /**
   * Check whether or not two versions are equal
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  eq: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return eq(target, current);
  },
  /**
   * Check whether or not two versions are distinct
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  neq: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return neq(target, current);
  },
  /**
   * Check whether or not a given version is less than a target version
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  lt: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return lt(target, current);
  },
  /**
   * Check whether or not a given version is at most equal to a target version
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  lte: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return lte(target, current);
  },
  /**
   * Check whether or not a given version is greater than a target version
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  gt: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return gt(target, current);
  },
  /**
   * Check whether or not a given version is at least equal to a target version
   *
   * @param {string} target - version to compare to
   * @param {string} [current] - version to check (optional, defaults to lib version)
   *
   * @returns {boolean}
   */
  gte: (target, current) => {
    isSemver(target, true);
    if (undefined === current) {
      current = VERSION;
    } else {
      isSemver(current, true);
    }
    return gte(target, current);
  },
};

export { version };
