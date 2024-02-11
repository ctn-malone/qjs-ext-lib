/** @format */
// @ts-check
'use strict;';

/*
    Based on https://github.com/vercel/arg/tree/5.0.0
 */

const flagSymbol = Symbol('arg flag');

class ArgError extends Error {
  /**
   * @param {string} msg
   * @param {string} code
   */
  constructor(msg, code) {
    super(msg);
    /** @type {string} */
    this.name = 'ArgError';
    /** @type {string} */
    this.code = code;

    Object.setPrototypeOf(this, ArgError.prototype);
  }
}

/**
 * @readonly
 * @enum {string}
 */
const ArgErrorCode = {
  ARG_CONFIG_NO_SPEC: 'ARG_CONFIG_NO_SPEC',
  ARG_CONFIG_EMPTY_KEY: 'ARG_CONFIG_EMPTY_KEY',
  ARG_CONFIG_NONAME_KEY: 'ARG_CONFIG_NONAME_KEY',
  ARG_CONFIG_NONOPT_KEY: 'ARG_CONFIG_NONOPT_KEY',
  ARG_CONFIG_VAD_TYPE: 'ARG_CONFIG_VAD_TYPE',
  ARG_CONFIG_SHORTOPT_TOOLONG: 'ARG_CONFIG_SHORTOPT_TOOLONG',
  ARG_INVALID_OPTION: 'ARG_INVALID_OPTION',
  ARG_MISSING_REQUIRED_LONGARG: 'ARG_MISSING_REQUIRED_LONGARG',
  ARG_MISSING_REQUIRED_OPTION: 'ARG_MISSING_REQUIRED_OPTION',
  ARG_MISSING_REQUIRED_SHORTARG: 'ARG_MISSING_REQUIRED_SHORTARG',
  ARG_UNKNOWN_OPTION: 'ARG_UNKNOWN_OPTION',
};

/**
 * @typedef {Object} ArgOptions
 * @property {string[]} [argv]
 * @property {boolean} [permissive]
 * @property {boolean} [stopAtPositional]
 */

/**
 * @callback ArgHandler
 * @param {string} value
 * @param {string} name
 * @param {any} [previousValue]
 * @param {number} index
 *
 * @returns {any}
 */

/**
 * @typedef {Boolean|Number|String} TypeConstructor
 */

/**
 * @typedef {ArgHandler|[ArgHandler]|string} ArgType
 */

/**
 * @typedef {Record<string, ArgType>} ArgSpecs
 */

/**
 * Parse arguments
 *
 * @param {ArgSpecs} specs
 * @param {ArgOptions} [options]
 */
const arg = (specs, options) => {
  if (!specs) {
    throw new ArgError(
      'argument specification object is required',
      ArgErrorCode.ARG_CONFIG_NO_SPEC
    );
  }
  options = options || {};
  const {
    // @ts-ignore
    argv = scriptArgs.slice(1),
    permissive = false,
    stopAtPositional = false,
  } = options;

  const result = {
    /** @type {string[]} */
    _: [],
  };

  const aliases = {};
  const handlers = {};

  for (const key of Object.keys(specs)) {
    if (!key) {
      throw new ArgError(
        'argument key cannot be an empty string',
        ArgErrorCode.ARG_CONFIG_EMPTY_KEY
      );
    }

    if (key[0] !== '-') {
      throw new ArgError(
        `argument key must start with '-' but found: '${key}'`,
        ArgErrorCode.ARG_CONFIG_NONOPT_KEY
      );
    }

    if (key.length === 1) {
      throw new ArgError(
        `argument key must have a name; singular '-' keys are not allowed: ${key}`,
        ArgErrorCode.ARG_CONFIG_NONAME_KEY
      );
    }

    if (typeof specs[key] === 'string') {
      aliases[key] = specs[key];
      continue;
    }

    let type = specs[key];
    let isFlag = false;

    if (
      Array.isArray(type) &&
      type.length === 1 &&
      typeof type[0] === 'function'
    ) {
      const [fn] = type;
      /** @type {ArgHandler} */
      type = (value, name, prev = [], index) => {
        prev.push(fn(value, name, prev[prev.length - 1], index));
        return prev;
      };
      isFlag = fn === Boolean || fn[flagSymbol] === true;
    } else if (typeof type === 'function') {
      isFlag = type === Boolean || type[flagSymbol] === true;
    } else {
      throw new ArgError(
        `type missing or not a function or valid array type: ${key}`,
        ArgErrorCode.ARG_CONFIG_VAD_TYPE
      );
    }

    if (key[1] !== '-' && key.length > 2) {
      throw new ArgError(
        `short argument keys (with a single hyphen) must have only one character: ${key}`,
        ArgErrorCode.ARG_CONFIG_SHORTOPT_TOOLONG
      );
    }

    handlers[key] = [type, isFlag];
  }

  for (let i = 0, len = argv.length; i < len; i++) {
    /** @type {string} */
    const wholeArg = argv[i];

    if (stopAtPositional && result._.length > 0) {
      result._ = result._.concat(argv.slice(i));
      break;
    }

    if (wholeArg === '--') {
      result._ = result._.concat(argv.slice(i + 1));
      break;
    }

    if (wholeArg.length > 1 && wholeArg[0] === '-') {
      /* eslint-disable operator-linebreak */
      const separatedArguments =
        wholeArg[1] === '-' || wholeArg.length === 2
          ? [wholeArg]
          : wholeArg
              .slice(1)
              .split('')
              .map((a) => `-${a}`);
      /* eslint-enable operator-linebreak */

      for (let j = 0; j < separatedArguments.length; j++) {
        /** @type {string} */
        const arg = separatedArguments[j];
        const [originalArgName, argStr] =
          arg[1] === '-' ? arg.split(/=(.*)/, 2) : [arg, undefined];

        let argName = originalArgName;
        while (argName in aliases) {
          argName = aliases[argName];
        }

        if (!(argName in handlers)) {
          if (permissive) {
            result._.push(arg);
            continue;
          } else {
            throw new ArgError(
              `unknown or unexpected option: ${originalArgName}`,
              ArgErrorCode.ARG_UNKNOWN_OPTION
            );
          }
        }

        const [type, isFlag] = handlers[argName];

        if (!isFlag && j + 1 < separatedArguments.length) {
          throw new ArgError(
            `option requires argument (but was followed by another short argument): ${originalArgName}`,
            ArgErrorCode.ARG_MISSING_REQUIRED_SHORTARG
          );
        }

        if (isFlag) {
          result[argName] = type(true, argName, result[argName], i);
        } else if (argStr === undefined) {
          if (
            argv.length < i + 2 ||
            (argv[i + 1].length > 1 &&
              argv[i + 1][0] === '-' &&
              !(
                argv[i + 1].match(/^-?\d*(\.(?=\d))?\d*$/) &&
                (type === Number ||
                  // eslint-disable-next-line no-undef
                  (typeof BigInt !== 'undefined' && type === BigInt))
              ))
          ) {
            const extended =
              originalArgName === argName ? '' : ` (alias for ${argName})`;
            throw new ArgError(
              `option requires argument: ${originalArgName}${extended}`,
              ArgErrorCode.ARG_MISSING_REQUIRED_LONGARG
            );
          }
          type === Number && ensureNumber(argName, argv[i + 1]);
          result[argName] = type(argv[i + 1], argName, result[argName], i);
          ++i;
        } else {
          type === Number && ensureNumber(argName, argStr);
          result[argName] = type(argStr, argName, result[argName], i);
        }
      }
    } else {
      result._.push(wholeArg);
    }
  }
  /**
   * Extra function to fallback to a default value
   *
   * @template [T=string]
   * @param {string} name
   * @param {T} defaultValue
   *
   * @returns {T}
   */
  result.get = function (name, defaultValue) {
    if (undefined === result[name]) {
      return defaultValue;
    }
    return result[name];
  };
  return result;
};

/**
 * @param {ArgHandler} fn
 * @returns {ArgHandler}
 */
arg.flag = (fn) => {
  fn[flagSymbol] = true;
  return fn;
};

// Utility types
arg.COUNT = arg.flag((v, name, existingCount) => (existingCount || 0) + 1);

// Expose error class
arg.ArgError = ArgError;
arg.ErrorCode = ArgErrorCode;

/**
 * @param {string} name
 * @param {string} value
 */
const ensureNumber = (name, value) => {
  if (value === undefined || !value.match(/^-?\d*(\.(?=\d))?\d*$/)) {
    throw new ArgError(
      `Invalid option value: ${name} ${value} (should be a number)`,
      ArgErrorCode.ARG_INVALID_OPTION
    );
  }
};

// TODO: define helpers (string, number, path)
// TODO: add an option to exit on error and print usage :)

export default arg;
