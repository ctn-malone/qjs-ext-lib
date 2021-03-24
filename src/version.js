"use strict;"

/*
    Helpers to perform versions comparison
    It only supports semver versions x.y.z where x, y & z are integers

    An exception will be thrown in case a non semver version is passed as argument
 */

const VERSION = '0.1.1';

/**
 * Check whether or not a version is in semver format
 *
 * @param {string} v version to check
 * @param {boolean} throwException if {true} an exception will be thrown if version does not match semver format (default = {false})
 *
 * @return {boolean}
 */
const isSemver = (v, throwException) => {
    if (!/^[0-9]\.[0-9]\.[0-9]$/.test(v)) {
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
}

/**
 * Split a version
 *
 * @param {string} v version to split
 *
 * @return {integer[]}
 */
const split = (v) => {
    const arr = v.split('.').map(e => parseInt(e));
    return arr;
}

/**
 * Check whether or not two versions are equal
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const eq = (current, target) => {
    return current === target;
}

/**
 * Check whether or not two versions are distinct
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const neq = (current, target) => {
    return current !== target;
}

/**
 * Check whether or not a given version is less than a target version
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const lt = (current, target) => {
    const _current = split(current);
    const _target = split(target);
    for (let i = 0; i < _current.length; ++i) {
        if (_current[i] > _target[i]) {
            return false;
        }
    }
    if (_current[2] >= _target[2]) {
        return false;
    }
    return true;
}

/**
 * Check whether or not a given version is at most equal to a target version
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const lte = (current, target) => {
    return eq(current, target) || lt(current, target);
}

/**
 * Check whether or not a given version is greater than a target version
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const gt = (current, target) => {
    const _current = split(current);
    const _target = split(target);
    for (let i = 0; i < _current.length; ++i) {
        if (_current[i] < _target[i]) {
            return false;
        }
    }
    if (_current[2] <= _target[2]) {
        return false;
    }
    return true;
}

/**
 * Check whether or not a given version is at least equal to a target version
 *
 * @param {string} current version to check
 * @param {string} target version to compare to
 *
 * @return {boolean}
 */
const gte = (current, target) => {
    return eq(current, target) || gt(current, target);
}

const version = {
    VERSION:VERSION,
    /**
     * Check whether or not two versions are equal
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    eq: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return eq(current, target);
    },
    /**
     * Check whether or not two versions are distinct
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    neq: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return neq(current, target);
    },
    /**
     * Check whether or not a given version is less than a target version
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    lt: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return lt(current, target);
    },
    /**
     * Check whether or not a given version is at most equal to a target version
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    lte: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return lte(current, target);
    },
    /**
     * Check whether or not a given version is greater than a target version
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    gt: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return gt(current, target);
    },
    /**
     * Check whether or not a given version is at least equal to a target version
     *
     * @param {string} current version to check
     * @param {string} target version to compare to (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    gte: (current, target) => {
        isSemver(current, true);
        if (undefined === target) {
            target = VERSION;
        }
        else {
            isSemver(target, true);
        }
        return gte(current, target);
    }
}

export {
    version
}