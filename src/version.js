"use strict;"

/*
    Helpers to perform versions comparison
    It only supports semver versions x.y.z where x, y & z are integers

    An exception will be thrown in case a non semver version is passed as argument
 */

const VERSION = '0.6.4';

/**
 * Check whether or not a version is in semver format
 *
 * @param {string} v version to check
 * @param {boolean} throwException if {true} an exception will be thrown if version does not match semver format (default = {false})
 *
 * @return {boolean}
 */
const isSemver = (v, throwException) => {
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(\-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/.test(v)) {
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
 * Reduce a semver version to an number
 *
 * @param {string} v version to reduce
 *
 * @return {integer} integer representation of the version
 */
const reduce = (v) => {
    const value = v.replace(/[-+].*$/g, '');    
    const arr = value.split('.').map(e => parseInt(e));
    let sum = 0;
    for (let i = 0; i < arr.length; ++i) {
        sum += arr[i] * Math.pow(10, i);
    }
    return sum;
}

/**
 * Check whether or not two versions are equal
 *
 * @param {string} target version to compare to
 * @param {string} current version to check
 *
 * @return {boolean}
 */
const eq = (target, current) => {
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
 * @param {string} target version to compare to
 * @param {string} current version to check
 *
 * @return {boolean}
 */
const lt = (target, current) => {
    const _current = reduce(current);
    const _target = reduce(target);
    return _current < _target;
}

/**
 * Check whether or not a given version is at most equal to a target version
 *
 * @param {string} target version to compare to
 * @param {string} current version to check
 *
 * @return {boolean}
 */
const lte = (target, current) => {
    return eq(target, current) || lt(target, current);
}

/**
 * Check whether or not a given version is greater than a target version
 *
 * @param {string} target version to compare to
 * @param {string} current version to check
 *
 * @return {boolean}
 */
const gt = (target, current) => {
    const _current = reduce(current);
    const _target = reduce(target);
    return _current > _target;
}

/**
 * Check whether or not a given version is at least equal to a target version
 *
 * @param {string} target version to compare to
 * @param {string} current version to check
 *
 * @return {boolean}
 */
const gte = (target, current) => {
    return eq(target, current) || gt(target, current);
}

const version = {
    VERSION:VERSION,
    /**
     * Check whether or not a version matches semver
     *
     * @param {string} version version to check
     *
     * @return {boolean}
     */
    isSemver: (version) => {
        return isSemver(version, false);
    },
    /**
     * Try to convert to semver
     * 
     * @param {string} version to convert
     * 
     * @return {string|undefined} will return {undefined} if {version} does not start with x.y.z
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
     * @param {string} target version to compare to
     * @param {string} current version to check (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    eq: (target, current) => {
        isSemver(target, true);
        if (undefined === current) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return eq(target, current);
    },
    /**
     * Check whether or not two versions are distinct
     *
     * @param {string} target version to compare to
     * @param {string} current version to check (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    neq: (target, current) => {
        isSemver(target, true);
        if (undefined === current) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return neq(target, current);
    },
    /**
     * Check whether or not a given version is less than a target version
     *
     * @param {string} current version to check (optional, defaults to lib version)
     * @param {string} target version to compare to
     *
     * @return {boolean}
     */
    lt: (target, current) => {
        isSemver(target, true);
        if (undefined === current) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return lt(target, current);
    },
    /**
     * Check whether or not a given version is at most equal to a target version
     *
     * @param {string} target version to compare to
     * @param {string} current version to check (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    lte: (target, current) => {
        isSemver(target, true);
        if (undefined === target) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return lte(target, current);
    },
    /**
     * Check whether or not a given version is greater than a target version
     *
     * @param {string} target version to compare to
     * @param {string} current version to check (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    gt: (target, current) => {
        isSemver(target, true);
        if (undefined === current) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return gt(target, current);
    },
    /**
     * Check whether or not a given version is at least equal to a target version
     *
     * @param {string} target version to compare to
     * @param {string} current version to check (optional, defaults to lib version)
     *
     * @return {boolean}
     */
    gte: (target, current) => {
        isSemver(target, true);
        if (undefined === current) {
            current = VERSION;
        }
        else {
            isSemver(current, true);
        }
        return gte(target, current);
    }
}

export {
    version
}
