/** @format */
// @ts-check
'use strict;';

import * as os from './os.js';
import * as std from './std.js';

import * as path from './path.js';
import { notNull } from './types.js';

/*
  Based on https://github.com/vercel/arg/tree/5.0.0

  See the "Validators" section for the enhancements
 */

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

const MESSAGE_ARG_MULTIPLE = 'it can be set multiple times';
const MESSAGE_FLAG_SET_BY_DEFAULT = 'set by default';

/*
  String used to separate argument names and usage definition
 */
const ARG_NAME_USAGE_SEPARATOR = ': ';

const DEFAULT_HELP_FLAGS = ['--help', '-h'];
const DEFAULT_VERSION_FLAGS = ['--version'];

/*
  Usage lines will be splitted in case they are too long
 */
const DEFAULT_USAGE_LAYOUT_MAX_LENGTH = 110;
/*
  Number of spaces before argument names
 */
const DEFAULT_USAGE_LAYOUT_ARG_NAME_INDENT = 2;
/*
  Minimum number of spaces between argument names and the beginning of usage

  "-v, --value VAL[    ]: this is usage"
 */
const DEFAULT_USAGE_LAYOUT_USAGE_INDENT = 4;
/*
  Text which will be displayed after argument names in usage
 */
const DEFAULT_USAGE_VALUE_TEXT = 'VAL';
/*
  Text to display for help flag in usage
 */
const DEFAULT_USAGE_HELP_DESCRIPTION = 'print help';
/*
  Text to display for version flag in usage
 */
const DEFAULT_USAGE_VERSION_DESCRIPTION = 'print version';
/*
  Message to display before enum values in usage
 */
const DEFAULT_USAGE_ENUM_MESSAGE = 'it can be one of';

class ArgError extends Error {
  /**
   * @param {string} msg
   * @param {string} code
   */
  constructor(msg, code) {
    super(msg);
    /** @type {string} */
    this.name = 'ArgError';
    /** @type {ArgErrorCode} */
    this.code = code;

    Object.setPrototypeOf(this, ArgError.prototype);
  }
}

/**
 * @typedef {Object} ArgUsageLayoutOptions
 * @property {number} [maxLength=110] - maximum length of a line
 * @property {number} [argNameIndent=4] - number of spaces before argument names
 * @property {number} [usageIndent=4] - number of spaces between argument names and usage
 * @property {boolean} [ignoreTtySize=false] - if true, don't adapt maximum length to tty size
 */

/**
 * @typedef {Object} ArgUsageOptions
 * @property {boolean} [enabled=false]
 * @property {ArgUsageLayoutOptions} [layout]
 */

/**
 * @typedef {Object} ArgHelpOptions
 * @property {boolean} [enabled=false]
 * @property {string} [description]
 * @property {string[]} [examples]
 * @property {string[]} [flags=["--help","-h"]]
 * @property {boolean} [capitalizeUsage=false]
 */

/**
 * @typedef {Object} ArgVersionOptions
 * @property {boolean} [enabled=false]
 * @property {string} [version]
 * @property {string[]} [flags=["--version"]]
 * @property {boolean} [capitalizeUsage=false]
 */

/**
 * @typedef {Object} ArgOptions
 * @property {string[]} [argv]
 * @property {boolean} [permissive=false]
 * @property {boolean} [stopAtPositional=false]
 * @property {boolean} [parse=true]
 * @property {ArgUsageOptions} [usage]
 * @property {ArgHelpOptions} [help]
 * @property {ArgVersionOptions} [version]
 * @property {string} [scriptName]
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
 * @typedef {ArgHandler|[ArgHandler]|ArgValidator|[ArgValidator]|string} ArgType
 */

/**
 * @typedef {Record<string, ArgType>} ArgSpecs
 */

/**
 * @typedef {Record<string, [Function, boolean, boolean, ArgValidator|undefined]>} Handlers
 */

/**
 * @typedef {Object} ArgOutput
 * @property {(name: string, defaultValue: any) => any} get - try to get argument value and fallback to default
 * @property {(name: string) => any} has - check whether or not an argument is defined
 * @property {() => void} parse - parse arguments
 * @property {() => string} getUsage - return usage content
 * @property {() => DescribeUsageOutput} describeUsage - return an object describing usage
 * @property {(message?: string) => void} usage - output usage to stderr and exit with code 2
 * @property {() => string} getHelp - return help content
 * @property {() => void} help - output help to stderr and exit with code 0
 * @property {string[]} _ - extra arguments (positional and unknown)
 */

/**
 * @typedef {'string'|'number'|'flag'|'file'|'dir'} DescribeUsageItemType
 */

/**
 * @typedef {Object} DescribeUsageItem
 * @property {string} name - argument name, starting with - or --
 * @property {(string|number|boolean)} [default] - only defined if argument has a default value
 * @property {string} valueText - text to display after argument names in usage (can be empty if argument does not accept a value)
 * @property {DescribeUsageItemType} type - argument type
 * @property {string[]} values - list of possible values (can be empty)
 * @property {string} format - name of the value format (ex: uuid or email) (empty if argument has no specific format)
 * @property {boolean} required - whether not argument is required (always false for flags)
 * @property {boolean} allowMany - whether or not argument can be set multiple times
 * @property {string} varName - name of the environment variable linked to this argument (can be empty)
 * @property {string[]} aliases - list of aliases for this argument (can be empty)
 * @property {string} description - argument description (can be empty)
 * @property {string} shortDescription - first line of the description (can be empty)
 * @property {boolean} allowNoFlags - whether or not --no-- flags are supported for this flag (always false for non flags arguments)
 */

/**
 * @typedef {DescribeUsageItem[]} DescribeUsageOutput
 */

/**
 * Return the TTY width or {undefined} if not available
 *
 * @return {number|undefined}
 */
const getTtyWidth = () => {
  if (!os.isatty(std.err.fileno())) {
    return;
  }
  const arr = os.ttyGetWinSize(std.err.fileno());
  if (!arr) {
    return;
  }
  return arr[0];
};

/**
 * @param {ArgUsageLayoutOptions} [options]
 *
 * @return {Required<ArgUsageLayoutOptions>}
 */
const getUsageLayoutOptions = (options = {}) => {
  const newOptions = {
    maxLength: options.maxLength ?? DEFAULT_USAGE_LAYOUT_MAX_LENGTH,
    argNameIndent:
      options.argNameIndent ?? DEFAULT_USAGE_LAYOUT_ARG_NAME_INDENT,
    usageIndent: options.usageIndent ?? DEFAULT_USAGE_LAYOUT_USAGE_INDENT,
    ignoreTtySize: options.ignoreTtySize === true,
  };
  // reduce maxLength if tty is smaller
  if (!newOptions.ignoreTtySize) {
    const ttyWidth = getTtyWidth();
    if (ttyWidth && ttyWidth < newOptions.maxLength) {
      newOptions.maxLength = ttyWidth - 5;
    }
  }
  return newOptions;
};

/**
 * @param {ArgUsageOptions} [options]
 *
 * @returns {Required<ArgUsageOptions>}
 */
const getUsageOptions = (options = {}) => {
  return {
    enabled: options.enabled === true,
    layout: getUsageLayoutOptions(options.layout),
  };
};

/**
 * @param {ArgHelpOptions} [options]
 *
 * @returns {Required<ArgHelpOptions>}
 */
const getHelpOptions = (options = {}) => {
  return {
    enabled: options.enabled === true,
    description: options.description ?? '',
    examples: options.examples?.length ? options.examples : [],
    flags: options.flags?.length ? options.flags : DEFAULT_HELP_FLAGS,
    capitalizeUsage: options.capitalizeUsage === true,
  };
};

/**
 * @param {ArgVersionOptions} [options]
 *
 * @returns {Required<ArgVersionOptions>}
 */
const getVersionOptions = (options = {}) => {
  return {
    enabled: options.enabled === true && !!options.version,
    version: options.version ?? '',
    flags: options.flags?.length ? options.flags : DEFAULT_VERSION_FLAGS,
    capitalizeUsage: options.capitalizeUsage === true,
  };
};

/**
 * Check whether a flag (short or long) is set
 *
 * @param {string[]} argv
 * @param {string} flag
 *
 * @returns {boolean}
 */
const checkFlag = (argv, flag) => {
  // search long flags directly
  if (flag.startsWith('--')) {
    return argv.includes(flag);
  }
  // -x -y can be written as -xy
  if (flag.startsWith('-')) {
    const name = flag.substring(1);
    for (const str of argv) {
      // only search short flags
      if (str.startsWith('--')) {
        continue;
      }
      if (!str.startsWith('-')) {
        continue;
      }
      if (str.includes(name)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Retrieve the main argument corresponding to an alias (recursively)
 *
 * @param {string} aliasName
 * @param {Record<string,string>} aliases
 *
 * @returns {string}
 */
const getMainArgName = (aliasName, aliases) => {
  while (aliasName in aliases) {
    aliasName = aliases[aliasName];
  }
  return aliasName;
};

/**
 * @param {string} str
 *
 * @return {string}
 */
const capitalize = (str) => {
  if (str.length === 1) {
    return str.toUpperCase();
  }
  return str.substring(0, 1).toUpperCase() + str.substring(1);
};

/**
 * @param {boolean} shouldCapitalize
 *
 * @returns {string}
 */
const getHelpUsage = (shouldCapitalize) => {
  if (!shouldCapitalize) {
    return DEFAULT_USAGE_HELP_DESCRIPTION;
  }
  return capitalize(DEFAULT_USAGE_HELP_DESCRIPTION);
};

/**
 * @param {boolean} shouldCapitalize
 *
 * @returns {string}
 */
const getVersionUsage = (shouldCapitalize) => {
  if (!shouldCapitalize) {
    return DEFAULT_USAGE_VERSION_DESCRIPTION;
  }
  return capitalize(DEFAULT_USAGE_VERSION_DESCRIPTION);
};

/**
 * @typedef {Handlers}
 */

/**
 * Parse arguments
 *
 * @param {ArgSpecs} specs
 * @param {ArgOptions} [options]
 *
 * @returns {ArgOutput}
 */
const arg = (specs, options) => {
  if (!specs) {
    throw new ArgError(
      'Argument specification object is required',
      ArgErrorCode.ARG_CONFIG_NO_SPEC
    );
  }
  options = options || {};
  const {
    // @ts-ignore
    argv = scriptArgs.slice(1),
    permissive = false,
    stopAtPositional = false,
    parse: shouldParse = true,
    scriptName = path.getScriptName(true),
  } = options;

  /** @type {ArgOutput} */
  // @ts-ignore
  const result = {
    /** @type {string[]} */
    _: [],
  };

  /** @type {Record<string, string>} */
  const aliases = {};
  /** @type {Handlers} */
  const handlers = {};

  for (const key of Object.keys(specs)) {
    if (!key) {
      throw new ArgError(
        'Argument key cannot be an empty string',
        ArgErrorCode.ARG_CONFIG_EMPTY_KEY
      );
    }

    if (key[0] !== '-') {
      throw new ArgError(
        `Argument key must start with '-' but found: '${key}'`,
        ArgErrorCode.ARG_CONFIG_NONOPT_KEY
      );
    }

    if (key.length === 1) {
      throw new ArgError(
        `Argument key must have a name; singular '-' keys are not allowed: ${key}`,
        ArgErrorCode.ARG_CONFIG_NONAME_KEY
      );
    }

    if (typeof specs[key] === 'string') {
      // @ts-ignore
      aliases[key] = specs[key];
      continue;
    }

    let type = specs[key];
    let isFlag = false;
    let allowMany = false;
    /** @type {ArgValidator|undefined} */
    let argValidator = undefined;

    if (
      Array.isArray(type) &&
      type.length === 1 &&
      (typeof type[0] === 'function' || type[0] instanceof ArgValidator)
    ) {
      allowMany = true;
      const [fn] = type;
      // legacy handler
      if (typeof fn === 'function') {
        type = (value, name, prev = [], index) => {
          prev.push(fn(value, name, prev[prev.length - 1], index));
          return prev;
        };
      }
      // validator
      else {
        const isRequired = /** @type {ArgValidator} */ (type[0]).isRequired();
        argValidator = fn;
        type = (value, name, prev = [], _index) => {
          if (value !== undefined || isRequired) {
            prev.push(fn.validate(value, name, prev));
          }
          return prev;
        };
      }
      // @ts-ignore
      isFlag = fn === Boolean;
    } else if (typeof type === 'function') {
      // @ts-ignore
      isFlag = type === Boolean;
    }
    // validator
    else if (type instanceof ArgValidator) {
      argValidator = type;
      const _argValidator = argValidator;
      type = (value, name, prev) => _argValidator.validate(value, name, prev);
      isFlag = false;
    } else {
      throw new ArgError(
        `Type missing or not a function or valid array type: ${key}`,
        ArgErrorCode.ARG_CONFIG_VAD_TYPE
      );
    }

    if (key[1] !== '-' && key.length > 2) {
      throw new ArgError(
        `Short argument keys (with a single hyphen) must have only one character: ${key}`,
        ArgErrorCode.ARG_CONFIG_SHORTOPT_TOOLONG
      );
    }

    handlers[key] = [type, isFlag, allowMany, argValidator];
  }

  const usageOptions = getUsageOptions(options.usage);
  const helpOptions = getHelpOptions(options.help);
  const versionOptions = getVersionOptions(options.version);

  result.parse = () => {
    try {
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

            let argName = getMainArgName(originalArgName, aliases);
            let isFlagOn = true;

            let unknownArg = !(argName in handlers);
            if (unknownArg) {
              /* 
                It could be a --no-x flag
                We need to search if a --x flag exists            
              */
              if (argName.startsWith('--no-')) {
                let newArgName = `--${argName.substring(5)}`;
                newArgName = getMainArgName(newArgName, aliases);
                if (newArgName in handlers) {
                  const [_type, isFlag, _allowMany, argValidator] =
                    handlers[newArgName];
                  if (
                    isFlag ||
                    (argValidator instanceof FlagArgValidator &&
                      /** @type {any} */ (argValidator)._allowNoFlag)
                  ) {
                    argName = newArgName;
                    unknownArg = false;
                    isFlagOn = false;
                  }
                }
              }
            }
            if (unknownArg) {
              if (permissive) {
                result._.push(arg);
                continue;
              } else {
                throw new ArgError(
                  `Unknown or unexpected option: ${originalArgName}`,
                  ArgErrorCode.ARG_UNKNOWN_OPTION
                );
              }
            }

            const [type, isFlag, _allowMany, argValidator] = handlers[argName];

            if (
              !isFlag &&
              !(argValidator instanceof FlagArgValidator) &&
              j + 1 < separatedArguments.length
            ) {
              throw new ArgError(
                `Argument requires value (but was followed by another short argument): ${originalArgName}`,
                ArgErrorCode.ARG_MISSING_REQUIRED_SHORTARG
              );
            }
            if (isFlag || argValidator instanceof FlagArgValidator) {
              result[argName] = type(
                isFlag ? isFlagOn : isFlagOn.toString(),
                argName,
                result[argName],
                i
              );
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
                  `Argument requires value: ${originalArgName}${extended}`,
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
    } catch (e) {
      if (e instanceof ArgError) {
        if (usageOptions.enabled) {
          result.usage(e.message);
        }
      }
      throw e;
    }

    /*
      Execute all remaining arg validators
     */
    for (const [argName, handler] of Object.entries(handlers)) {
      const [type, _isFlag, _allowMany, argValidator] = handler;
      if (!argValidator) {
        continue;
      }
      if (result.hasOwnProperty(argName)) {
        continue;
      }
      try {
        const value = type(undefined, argName, undefined, undefined);
        if (value === undefined) {
          continue;
        }
        if (Array.isArray(value) && !value.length) {
          continue;
        }
        result[argName] = value;
      } catch (e) {
        if (e instanceof ArgError) {
          if (usageOptions.enabled) {
            result.usage(e.message);
          }
        }
        throw e;
      }
    }

    /*
      Replace result entries for flag validators with count
     */
    for (const [argName, handler] of Object.entries(handlers)) {
      const [_type, _isFlag, allowMany, argValidator] = handler;
      if (!(argValidator instanceof FlagArgValidator)) {
        continue;
      }
      if (/** @type {any} */ (argValidator)._count) {
        result[argName] = (
          allowMany ? result[argName] : [result[argName]]
        ).filter((/** @type {any} */ flag) => !!flag).length;
      }
    }
  };

  /**
   * Extra function to fallback to a default value
   *
   * @param {string} name
   * @param {any} defaultValue
   *
   * @returns {any}
   */
  result.get = (name, defaultValue) => {
    if (result[name] === undefined) {
      return defaultValue;
    }
    return result[name];
  };

  /**
   * Extra function to know whether or not an argument is defined
   *
   * @param {string} name
   *
   * @returns {boolean}
   */
  result.has = (name) => {
    if (result[name] === undefined) {
      return false;
    }
    if (Array.isArray(result[name]) && !result[name].length) {
      return false;
    }
    return true;
  };

  /**
   * Return usage content
   *
   * @returns {string}
   */
  result.getUsage = () => {
    return getUsage(
      handlers,
      aliases,
      helpOptions,
      versionOptions,
      /** @type {Required<ArgUsageLayoutOptions>} */ (usageOptions.layout),
      scriptName
    );
  };

  /**
   * Print usage and exit with code 2
   *
   * @param {string} [errMessage] - error message to print before usage
   */
  result.usage = (errMessage) => {
    if (errMessage) {
      std.err.puts(`${errMessage.trim()}\n\n`);
    }
    std.err.puts(`${result.getUsage()}\n`);
    std.exit(2);
  };

  /**
   * Return an Object[] describing usage
   *
   * @returns {DescribeUsageOutput}
   */
  result.describeUsage = () => {
    return describeUsage(handlers, aliases, helpOptions, versionOptions);
  };

  /**
   * Return help content
   *
   * @returns {string}
   */
  result.getHelp = () => {
    return getHelp(
      handlers,
      aliases,
      helpOptions,
      versionOptions,
      /** @type {Required<ArgUsageLayoutOptions>} */ (usageOptions.layout),
      scriptName
    );
  };

  /**
   * Print help and exit with code 0
   */
  result.help = () => {
    std.out.puts(`${result.getHelp()}\n`);
    std.exit(0);
  };

  /*
    Check --help & --version
   */
  if (helpOptions.enabled) {
    for (const flag of helpOptions.flags) {
      if (checkFlag(argv, flag)) {
        result.help();
      }
    }
  }
  if (versionOptions.enabled) {
    for (const flag of versionOptions.flags) {
      if (checkFlag(argv, flag)) {
        std.out.puts(`${versionOptions.version}\n`);
        std.exit(0);
      }
    }
  }

  if (getValueFromEnv('DESCRIBE_USAGE') !== undefined) {
    const output = describeUsage(
      handlers,
      aliases,
      helpOptions,
      versionOptions
    );
    std.out.puts(`${JSON.stringify(output, null, 2)}\n`);
    std.exit(0);
  }

  if (shouldParse) {
    result.parse();
  }

  return result;
};

// Expose error class
arg.ArgError = ArgError;
arg.ErrorCode = ArgErrorCode;

/**
 * @param {string} value
 *
 * @returns {boolean}
 */
const isValidNumber = (value) => {
  return value !== undefined && !!value.match(/^[-+]?(\d+(\.\d*)?|\.\d+)$/);
};

/**
 * @param {string} value
 *
 * @returns {boolean}
 */
const isValidInteger = (value) => {
  return value !== undefined && !!value.match(/^[-+]?(\d+)$/);
};

/**
 * @param {string} name
 * @param {string} value
 */
const ensureNumber = (name, value) => {
  if (!isValidNumber(value)) {
    throw new ArgError(
      `Invalid argument value: ${name} ${value} (it should be a number)`,
      ArgErrorCode.ARG_INVALID_OPTION
    );
  }
};

export default arg;

/*
  Validators are inspired by https://github.com/hapijs/joi
  
  Each validator contains some function which can be chained to validate an argument :

  - marking an argument as required
  - provided a default value
  - provide a description (used when generating help)
  - provide a custom message in case of validation error
  - string validation
    * enum
    * regexp
    * length
    * ...
  - number validation
    * integer
    * range
    * ...
  - file/directory validation
    * check if entry exists
    * ensure entry exists
    * check if parent directory exists
    * ensure parent directory exists
    * ...
  - flags
    * supports both --some-flag and --no-some-flag
  - custom validation function
  
  Validation functions are called in the order they were chained, with following exceptions

  - when using .func1().func2().func1(), func1 will be called first and only once
  - when using .cust().cust(), both custom validation function will be called
  - if a custom validation function returns "false", subsequent validation functions will be ignored

  A custom mapping function can be used to transform the value at the end of validation

 */

/**
 * Remove leading and trailing \n
 *
 * @param {string} str
 *
 * @returns {string}
 */
const trimString = (str) => {
  if (str.startsWith('\n')) {
    str = str.substring(1);
  }
  if (str.endsWith('\n')) {
    str = str.slice(0, -1);
  }
  return str;
};

/**
 * Split a sentence (without \n) into lines which are smaller than a maximum length
 *
 * @param {string} sentence
 * @param {number} [maxLength]
 *
 * @returns {string[]}
 */
const splitSentence = (sentence, maxLength) => {
  if (!maxLength || sentence.length <= maxLength) {
    return [sentence];
  }
  const words = sentence.split(/\s+/g);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length > maxLength) {
      lines.push(currentLine.trim());
      currentLine = '';
    }
    currentLine += `${word} `;
  }
  if (currentLine.length) {
    lines.push(currentLine.trim());
  }

  return lines;
};

/**
 * Split a paragraph (which can contain \n) into lines which are smaller than a maximum length
 *
 * @param {string} paragraph
 * @param {number} [maxLength]
 *
 * @returns {string[]}
 */
const splitParagraph = (paragraph, maxLength) => {
  const lines = [];
  /*
    Remove leading and trailing \n but keep extra \n
   */
  const trimmedParagraph = trimString(paragraph);
  const sentences = trimmedParagraph.split('\n');
  for (const sentence of sentences) {
    if (sentence === '') {
      lines.push(sentence);
      continue;
    }
    lines.push(...splitSentence(sentence, maxLength));
  }
  return lines;
};

/**
 * Retrieve a value from environment
 *
 * @param {string|undefined} varName
 *
 * @returns {string|undefined}
 */
const getValueFromEnv = (varName) => {
  if (varName === undefined) {
    return undefined;
  }
  return std.getenv(varName);
};

/**
 * @param {boolean} isFlag
 * @param {Object} [options]
 * @param {string} [options.description]
 * @param {any} [options.defaultValue]
 * @param {number} [options.maxLength] - maximum length of a line
 *
 * @returns {string|undefined}
 */
const getDescription = (isFlag, options = {}) => {
  let { description, defaultValue, maxLength } = options;
  /** @type {string|undefined} */
  let defaultValueMessage;

  if (defaultValue) {
    defaultValueMessage = `(default: ${defaultValue})`;
    if (isFlag) {
      // only output message if flag is set by default
      defaultValueMessage = defaultValue
        ? `(${MESSAGE_FLAG_SET_BY_DEFAULT})`
        : undefined;
    }
  }

  if (!description) {
    return defaultValueMessage;
  }
  description = splitParagraph(description, maxLength).join('\n');

  if (defaultValueMessage) {
    return `${description} ${defaultValueMessage}`;
  }
  return description;
};

/**
 * @type {Record<string,RegExp|FormatValidatorFunc>}
 */
const formats = {
  uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  email: /^\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b$/,
  date: /^(19|20)\d\d-(?:0[1-9]|1[012])-0(?:[1-9]|[12][0-9]|3[01])$/,
  time: /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/,
  datetime:
    /^(19|20)\d\d-(?:0[1-9]|1[012])-0(?:[1-9]|[12][0-9]|3[01]) (?:[01][0-9]|2[0-3]):[0-5][0-9]$/,
};

/**
 * @template [T=string]
 * @callback ValueValidatorFunc
 * @param {T} argValue
 *
 * @returns {false|void}
 */

/**
 * @readonly
 * @enum {string}
 */
const ValueValidatorType = {
  CUSTOM: 'cust',
  ENUM: 'enum',
  FORMAT: 'fmt',
  IS_INT: 'int',
  MIN: 'min',
  MAX: 'max',
  IS_POSITIVE: 'pos',
  IS_NEGATIVE: 'neg',
  REGEXP: 'reg',
  CHECK_PATH: 'checkPath',
  CHECK_PARENT_DIR: 'checkParentDir',
  ENSURE_PATH: 'ensurePath',
  ENSURE_PARENT_DIR: 'ensureParentDir',
};

/**
 * @template [T=string]
 * @typedef ValueValidator
 * @property {ValueValidatorType} type
 * @property {ValueValidatorFunc<T>} func
 * @property {string} [description]
 */

/**
 * @template T
 * @callback ValueMapper
 * @param {T} argValue
 *
 * @returns {any}
 */

/**
 * Format a generated usage message (ex: corresponding env var or enum)
 *
 * - split into lines which are smaller than a maximum length
 * - indent first line using "  - "
 * - indent other lines using "    "
 *
 * @param {string} message
 * @param {number} [maxLength]
 *
 * @return {string[]}
 */
const formatGeneratedUsageMessage = (message, maxLength) => {
  const lines = splitSentence(message, maxLength);
  for (let i = 0; i < lines.length; ++i) {
    if (i === 0) {
      lines[i] = `  - ${lines[i]}`;
    } else {
      lines[i] = `    ${lines[i]}`;
    }
  }
  return lines;
};

/**
 * @abstract
 * @class
 */
class ArgValidator {
  /**
   * @param {string} baseType
   * @param {string|number|boolean} [defaultValue]
   *
   * @throws {Error} if defaultValue is of the wrong type
   */
  constructor(baseType, defaultValue) {
    if (defaultValue !== undefined) {
      if (typeof defaultValue !== baseType) {
        throw new Error(`Argument 'defaultValue' should be a '${baseType}'`);
      }
    }

    /**
     * @protected
     * @type {string|number|boolean|undefined}
     */
    this._defaultValue = defaultValue;

    /**
     * @protected
     * @type {string|undefined}
     */
    this._valueText = undefined;

    /**
     * @private
     * @type {string|undefined}
     */
    this._varName = undefined;

    /**
     * @private
     * @type {string|undefined}
     */
    this._description = undefined;

    /**
     * @protected
     * @type {string|undefined}
     */
    this._errMessage = undefined;

    /**
     * @protected
     * @type {boolean}
     */
    this._required = false;

    /**
     * @private
     * @type {ValueMapper<any>}
     */
    this._mapValueCb = (argValue) => argValue;

    /**
     * @private
     * @type {ValueValidator<any>[]}
     */
    this._validators = [];
  }

  /**
   * Define the environment variable to check
   *
   * @param {string} varName
   *
   * @returns {this}
   */
  env(varName) {
    this._varName = varName;
    return this;
  }

  /**
   * Add a custom validation function
   *
   * @param {ValueValidatorFunc<any>} customCb
   *
   * @returns {this}
   * @throws {Error} if "customCb" is not a Function
   */
  cust(customCb) {
    if (typeof customCb !== 'function') {
      throw new Error("Argument 'customCb' should be a Function");
    }
    this.setValidator(ValueValidatorType.CUSTOM, customCb, { replace: false });
    return this;
  }

  /**
   * @param {string} description - description to display
   *
   * @returns {this}
   * @throws {Error} if "description" is not a string
   */
  desc(description) {
    if (typeof description !== 'string') {
      throw new Error("Argument 'description' should be a string");
    }
    if (description) {
      this._description = description.trim();
    }
    return this;
  }

  /**
   * Add a mapping function which will be called after all validators
   *
   * @param {any} mapValueCb
   *
   * @returns {this}
   * @throws {Error} if "mapValueCb" is not a Function
   */
  map(mapValueCb) {
    if (typeof mapValueCb !== 'function') {
      throw new Error("Argument 'mapValueCb' should be a Function");
    }
    this._mapValueCb = mapValueCb;
    return this;
  }

  /**
   * Validate an argument (calls all validators)
   *
   * @param {string|undefined} rawValue
   * @param {string} argName
   * @param {any[]} [previous]
   *
   * @returns {any}
   * @throws {Error} if "rawValue" is not a string
   * @throws {ArgError}
   */
  validate(rawValue, argName, previous) {
    if (rawValue !== undefined && typeof rawValue !== 'string') {
      throw new Error("Argument 'rawValue' should be a string");
    }
    /** @type {any} */
    let value = rawValue;
    let fromEnv = false;
    if (value === undefined) {
      value = getValueFromEnv(this._varName);
      if (value === undefined) {
        value = this._defaultValue;
      } else {
        fromEnv = true;
      }
    }
    if (value === undefined) {
      if (this._required) {
        throw new ArgError(
          `Argument ${argName} is required`,
          ArgErrorCode.ARG_MISSING_REQUIRED_OPTION
        );
      }
    }
    if (value === undefined) {
      return undefined;
    }
    try {
      value = this._parseValue(
        typeof value === 'string' ? value : String(value)
      );
      for (const validator of this._validators) {
        const result = validator.func(value);
        if (result === false) {
          break;
        }
      }
      /*
        Don't call value mapper if we only want to count
        the number of time flag was set
       */
      if (this instanceof FlagArgValidator) {
        if (/** @type {any} */ (this)._count === true) {
          return value;
        }
      }
      return this._mapValueCb(value);
    } catch (/** @type {any} */ e) {
      const isFlag = this instanceof FlagArgValidator;
      let message = `Invalid ${
        isFlag ? 'flag' : 'argument'
      } value: ${argName} ${value}`;
      if (fromEnv) {
        message += ` (env[${this._varName}])`;
      }
      const errMessage = this._errMessage ?? e.message.trim();
      if (errMessage) {
        message += ` (${errMessage})`;
      }
      throw new ArgError(message, ArgErrorCode.ARG_INVALID_OPTION);
    }
  }

  /**
   * @returns {boolean}
   */
  isRequired() {
    return this._required;
  }

  /**
   * Get usage information
   *
   * @param {Object} [options]
   * @param {number} [options.maxLength] - maximum length of a line
   * @param {boolean} [options.allowMany=false] - whether or not argument can be set multiple times
   *
   * @returns {string[]}
   */
  getUsage(options = {}) {
    const { allowMany = false } = options;
    const usage = [];
    const isFlag = this instanceof FlagArgValidator;
    const description = getDescription(isFlag, {
      description: this._description,
      defaultValue: this._defaultValue,
      maxLength: options.maxLength,
    });
    if (description) {
      usage.push(...splitParagraph(description, options.maxLength));
    }
    for (const validator of this._validators) {
      if (validator.description) {
        usage.push(
          ...formatGeneratedUsageMessage(
            validator.description,
            options.maxLength
          )
        );
      }
    }
    if (allowMany) {
      usage.push(
        ...formatGeneratedUsageMessage(MESSAGE_ARG_MULTIPLE, options.maxLength)
      );
    }
    if (this._varName) {
      usage.push(
        ...formatGeneratedUsageMessage(
          `it can be passed as '${this._varName}' environment variable`,
          options.maxLength
        )
      );
    }
    return usage;
  }

  /**
   * Return an object describing usage
   *
   * @param {string} argName
   * @param {boolean} allowMany - whether or not argument can be set multiple times
   * @param {string[]} aliases - list of aliases for this argument (can be empty)
   *
   * @returns {DescribeUsageItem}
   */
  describeUsage(argName, allowMany, aliases) {
    /** @type {DescribeUsageItem} */
    const item = createUsageItem(argName, 'string', allowMany, false, [
      ...aliases,
    ]);
    item.required = this._required;
    if (this._defaultValue !== undefined) {
      item.default = this._defaultValue;
    }
    if (this._description) {
      item.description = this._description;
    }
    if (this._varName) {
      item.varName = this._varName;
    }
    if (item.description) {
      item.shortDescription = item.description.split('\n')[0];
    }
    if (this instanceof ArgValidatorWithValue) {
      item.valueText = this.getValueText();
    }
    return item;
  }

  /**
   * Add/update a validator
   *
   * @protected
   * @template [T=string]
   * @param {ValueValidatorType} type
   * @param {ValueValidatorFunc<T>} func
   * @param {Object} [options]
   * @param {boolean} [options.replace=true] - whether or not validator should be replaced
   * @param {string} [options.description] - used to generate usage
   */
  setValidator(type, func, options = {}) {
    const { replace = true, description } = options;
    /** @type {ValueValidator<any>} */
    const validator = { type, func, description };
    if (replace !== false) {
      const index = this._validators.findIndex((item) => item.type === type);
      if (index !== -1) {
        this._validators[index] = validator;
        return;
      }
    }
    this._validators.push(validator);
  }

  /**
   * Parse the string value and return an appropriate type
   *
   * @protected
   * @param {string} rawValue
   *
   * @returns {any}
   * @throws {ArgError}
   */
  _parseValue(rawValue) {
    return rawValue;
  }

  /**
   * @returns {ArgValidator}
   */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this));
    Object.getOwnPropertyNames(this).forEach((key) => {
      // @ts-ignore
      copy[key] = Array.isArray(this[key]) ? [...this[key]] : this[key];
    });
    return copy;
  }
}

/**
 * @abstract
 * @class
 */
class ArgValidatorWithValue extends ArgValidator {
  /**
   * @param {string} type
   * @param {string|number} [defaultValue]
   * @throws {Error} if defaultValue is of the wrong type
   */
  constructor(type, defaultValue) {
    super(type, defaultValue);
  }

  /**
   * Mark argument as required
   *
   * @param {boolean} [isRequired=true]
   *
   * @returns {this}
   */
  req(isRequired = true) {
    if (typeof isRequired !== 'boolean') {
      throw new Error("Argument 'isRequired' should be a boolean");
    }
    this._required = isRequired;
    return this;
  }

  /**
   * @param {string} message - message to display in case of validation error, instead of the auto-generated one
   *
   * @returns {this}
   * @throws {Error} if "message" is not a string
   */
  err(message) {
    if (typeof message !== 'string') {
      throw new Error("Argument 'message' should be a string");
    }
    if (message) {
      this._errMessage = message.trim();
    }
    return this;
  }

  /**
   * Set the text which will be displayed after argument names in usage
   *
   * @param {string} text
   *
   * @return {this}
   */
  val(text) {
    if (text) {
      this._valueText = text;
    }
    return this;
  }

  /**
   * Retrieve the text which will be displayed after argument names in usage
   *
   * @returns {string}
   */
  getValueText() {
    return this._valueText ?? DEFAULT_USAGE_VALUE_TEXT;
  }
}

/**
 * @abstract
 * @class
 * @extends {ArgValidatorWithValue}
 */
class BaseStringArgValidator extends ArgValidatorWithValue {
  /**
   * @param {string} [defaultValue]
   */
  constructor(defaultValue) {
    super('string', defaultValue);

    /**
     * @protected
     * @type {boolean}
     */
    this._trim = true;
  }

  /**
   * Set default value
   *
   * @param {string|undefined} defaultValue
   *
   * @return {this}
   * @throws {Error} if "defaultValue" is not a string
   */
  def(defaultValue) {
    if (defaultValue !== undefined) {
      if (typeof defaultValue !== 'string') {
        throw new Error("Argument 'defaultValue' should be a string");
      }
    }
    this._defaultValue = defaultValue;
    return this;
  }

  /**
   * @param {ValueValidatorFunc<string>} customCb
   */
  cust(customCb) {
    return super.cust(customCb);
  }

  /**
   * @param {ValueMapper<string>} mapValueCb
   */
  map(mapValueCb) {
    return super.map(mapValueCb);
  }

  /**
   * Trim value before validation
   *
   * @param {boolean} [trimContent=true]
   *
   * @returns {this}
   * @throws {Error} if "trimContent" is not a boolean
   */
  trim(trimContent = true) {
    if (typeof trimContent !== 'boolean') {
      throw new Error("Argument 'trimContent' should be a boolean");
    }
    this._trim = trimContent;
    return this;
  }

  /**
   * @protected
   * @param {string} rawValue
   *
   * @returns {string}
   * @throws {ArgError}
   */
  _parseValue(rawValue) {
    return this._trim ? rawValue.trim() : rawValue;
  }
}

/**
 * @class
 * @extends {BaseStringArgValidator}
 */
class StringArgValidator extends BaseStringArgValidator {
  /**
   * @param {string} [defaultValue]
   */
  constructor(defaultValue) {
    super(defaultValue);

    /**
     * @private
     * @type {string|undefined}
     */
    this._format = undefined;

    /**
     * @private
     * @type {string[]|undefined}
     */
    this._enum = undefined;
  }

  /**
   * Ensure value matches a RegExp
   *
   * @param {RegExp} regexp
   *
   * @returns {this}
   * @throws {Error} if "regexp" is not a RegExp
   */
  reg(regexp) {
    if (!(regexp instanceof RegExp)) {
      throw new Error(`Argument 'regexp' should be a RegExp`);
    }
    this.setValidator(ValueValidatorType.REGEXP, (value) => {
      if (!regexp.test(value)) {
        throw new Error(`it should match ${regexp.toString()}`);
      }
    });
    return this;
  }

  /**
   * Ensure length of value is >= min length
   *
   * @param {number} minLength
   *
   * @returns {this}
   * @throws {Error} if "minLength" is not a number
   */
  min(minLength) {
    if (typeof minLength !== 'number') {
      throw new Error("Argument 'min' should be number");
    }
    const cond = Math.floor(minLength);
    this.setValidator(ValueValidatorType.MIN, (value) => {
      if (value.length < cond) {
        throw new Error(`it should have a length >= ${minLength}`);
      }
    });
    return this;
  }

  /**
   * Ensure length of value is <= max length
   *
   * @param {number} maxLength
   *
   * @returns {this}
   * @throws {Error} if "maxLength" is not a number
   */
  max(maxLength) {
    if (typeof maxLength !== 'number') {
      throw new Error("Argument 'max' should be number");
    }
    const cond = Math.ceil(maxLength);
    this.setValidator(ValueValidatorType.MAX, (value) => {
      if (value.length > maxLength) {
        throw new Error(`it should have a length <= ${maxLength}`);
      }
    });
    return this;
  }

  /**
   * Ensure value is one of possible values
   *
   * @param {string[]} possibleValues
   * @param {string} [message="it can be one of"]
   *
   * @returns {this}
   * @throws {Error} if "possibleValues" is empty or not an Array of strings
   */
  enum(possibleValues, message) {
    if (!Array.isArray(possibleValues)) {
      throw new Error("Argument 'enum' should be an array");
    }
    if (!possibleValues.length) {
      throw new Error("Argument 'enum' cannot be an empty array");
    }
    for (const value of possibleValues) {
      if (typeof value !== 'string') {
        throw new Error(
          `Argument 'enum' should be an array of strings (${value})`
        );
      }
    }
    message = message?.trim() || DEFAULT_USAGE_ENUM_MESSAGE;
    this._enum = [...possibleValues];
    const values = /** @type {const} */ this._enum;
    const description = `${message} [${values.join(', ')}]`;
    this.setValidator(
      ValueValidatorType.ENUM,
      (value) => {
        if (!values.includes(value)) {
          throw new Error(`it should be one of [${values.join(', ')}]`);
        }
      },
      { description }
    );
    return this;
  }

  /**
   * Ensure value matches a named format
   *
   * @param {string} formatName
   *
   * @returns {this}
   * @throws {Error} if "formatName" is not a string or is an unknown format
   */
  fmt(formatName) {
    if (typeof formatName !== 'string') {
      throw new Error("Argument 'fmt' should be a string");
    }
    const cond = formats[formatName];
    // ensure format is supported
    if (cond === undefined) {
      throw new Error(`Format '${formatName}' is not supported`);
    }
    this._format = formatName;
    this.setValidator(ValueValidatorType.FORMAT, (value) => {
      let isValid = true;
      if (cond instanceof RegExp) {
        if (!cond.test(value)) {
          isValid = false;
        }
      } else {
        isValid = cond(value);
      }
      if (!isValid) {
        throw new Error(`it should be a valid ${formatName}`);
      }
    });
    return this;
  }

  /**
   * Retrieve the text which will be displayed after argument names in usage
   *
   * @returns {string}
   */
  getValueText() {
    if (this._valueText) {
      return this._valueText;
    }
    if (this._format) {
      return this._format.toUpperCase();
    }
    return super.getValueText();
  }

  /**
   * Return an object describing usage
   *
   * @param {string} argName
   * @param {boolean} allowMany - whether or not argument can be set multiple times
   * @param {string[]} aliases - list of aliases for this argument (can be empty)
   *
   * @returns {DescribeUsageItem}
   */
  describeUsage(argName, allowMany, aliases) {
    const output = super.describeUsage(argName, allowMany, aliases);
    if (this._format) {
      output.format = this._format;
    }
    if (this._enum) {
      output.values = [...this._enum];
    }
    return output;
  }

  /**
   * @returns {StringArgValidator}
   */
  clone() {
    return /** @type {StringArgValidator} */ (super.clone());
  }
}

/**
 * @class
 * @extends {BaseStringArgValidator}
 */
class PathArgValidator extends BaseStringArgValidator {
  /**
   * @param {string} [defaultValue]
   */
  constructor(defaultValue) {
    super(defaultValue);

    /**
     * @protected
     * @type {boolean}
     */
    this._isDir = false;

    /**
     * @private
     * @type {boolean}
     */
    this._allowStd = false;

    /**
     * @private
     * @type {boolean}
     */
    this._read = false;
    /**
     * @private
     * @type {boolean}
     */
    this._json = false;
    /**
     * @private
     * @type {boolean}
     */
    this._trimFileContent = false;

    this.setValidator(ValueValidatorType.CUSTOM, (value) => {
      if (value === '') {
        throw new Error(`cannot be empty`);
      }
      if (value === '-') {
        if (!this._allowStd || this._isDir) {
          throw new Error(`'-' is not allowed'`);
        }
        return false;
      }
    });

    /** @private */
    this._customMap = /** @type {ValueMapper<string>} */ (value) => {
      if (this._read) {
        value = this._readFile(value);
        if (this._trimFileContent) {
          value = value.trim();
        }
        if (this._json) {
          let jsonValue;
          try {
            jsonValue = JSON.parse(value);
          } catch (e) {
            throw new Error('not a valid json file');
          }
          return jsonValue;
        }
      }
      return value;
    };
    super.map(this._customMap);
  }

  /**
   * @param {ValueMapper<any>} mapValueCb
   */
  map(mapValueCb) {
    super.map(
      /** @type {ValueMapper<string>} */ (value) => {
        value = this._customMap(value);
        return mapValueCb(value);
      }
    );
    return this;
  }

  /**
   * Indicate value represents a directory path
   *
   * @param {boolean} [isDir=true]
   *
   * @returns {this}
   */
  dir(isDir = true) {
    if (typeof isDir !== 'boolean') {
      throw new Error("Argument 'isDir' should be a boolean");
    }
    this._isDir = isDir;
    return this;
  }

  /**
   * Allow reading from stdin and writing to stdout using '-'
   *
   * @param {boolean} [allowStd=true]
   *
   * @returns {this}
   */
  std(allowStd = true) {
    if (typeof allowStd !== 'boolean') {
      throw new Error("Argument 'allowStd' should be a boolean");
    }
    this._allowStd = allowStd;
    return this;
  }

  /**
   * Read file content at the end of validation
   *
   * @param {Object} [opt]
   * @param {boolean} [opt.json=false] - if true, parse the content as json
   * @param {boolean} [opt.trim=false] - if true, trim the content
   *
   * @returns {this}
   */
  read(opt = {}) {
    this._read = true;
    this._json = !!opt?.json;
    this._trimFileContent = !!opt?.trim;
    return this;
  }

  /**
   * Indicates whether or not path should exists
   *
   * @param {boolean} [shouldExist=true]
   *
   * @returns {this}
   * @throws {Error} if entry does not exists or is of the wrong type
   */
  check(shouldExist = true) {
    if (typeof shouldExist !== 'boolean') {
      throw new Error("Argument 'shouldExist' should be a boolean");
    }
    this.setValidator(ValueValidatorType.CHECK_PATH, (value) => {
      const exists = this._checkPath(value, this._isDir);
      if (shouldExist) {
        if (!exists) {
          if (this._isDir) {
            throw new Error(`directory should exist`);
          }
          throw new Error(`file should exist`);
        }
      } else {
        if (exists) {
          if (this._isDir) {
            throw new Error(`directory should not exist`);
          }
          throw new Error(`file should not exist`);
        }
      }
    });
    return this;
  }

  /**
   * Indicates parent directory should exist
   *
   * @returns {this}
   * @throws {Error} if parent directory does not exist
   */
  checkParent() {
    this.setValidator(ValueValidatorType.CHECK_PARENT_DIR, (value) => {
      const parentDir = this._getParentDir(value);
      if (!this._checkPath(parentDir, true)) {
        throw new Error(`parent directory should exist`);
      }
    });
    return this;
  }

  /**
   * Ensure file/directory exists and create it if needed
   *
   * @returns {this}
   * @throws {Error} if entry cannot be created
   */
  ensure() {
    this.setValidator(ValueValidatorType.ENSURE_PATH, (value) => {
      if (this._checkPath(value, this._isDir)) {
        return;
      }
      if (this._isDir) {
        const errCode = this._ensureDir(value);
        if (errCode) {
          throw new Error(`could not create directory - errCode: ${errCode}`);
        }
        return;
      }
      const parentDir = this._getParentDir(value);
      const errCode = this._ensureDir(parentDir);
      if (errCode) {
        throw new Error(
          `could not create parent directory - errCode: ${errCode}`
        );
      }
      const fd = os.open(value, os.O_CREAT);
      if (fd < 0) {
        throw new Error(`could not create file - errCode: ${-fd}`);
      }
    });
    return this;
  }

  /**
   * Ensure parent directory exists and create it if needed
   *
   * @returns {this}
   * @throws {Error} if parent directory cannot be created
   */
  ensureParent() {
    this.setValidator(ValueValidatorType.ENSURE_PARENT_DIR, (value) => {
      const parentDir = this._getParentDir(value);
      if (this._checkPath(parentDir, true)) {
        return;
      }
      const errCode = this._ensureDir(parentDir);
      if (errCode) {
        throw new Error(
          `could not create parent directory - errCode: ${errCode}`
        );
      }
    });
    return this;
  }

  /**
   * Retrieve the text which will be displayed after argument names in usage
   *
   * @returns {string}
   */
  getValueText() {
    if (this._valueText) {
      return this._valueText;
    }
    return this._isDir ? 'DIR' : 'FILE';
  }

  /**
   * Return an object describing usage
   *
   * @param {string} argName
   * @param {boolean} allowMany - whether or not argument can be set multiple times
   * @param {string[]} aliases - list of aliases for this argument (can be empty)
   *
   * @returns {DescribeUsageItem}
   */
  describeUsage(argName, allowMany, aliases) {
    const output = super.describeUsage(argName, allowMany, aliases);
    output.type = this._isDir ? 'dir' : 'file';
    return output;
  }

  /**
   * @returns {PathArgValidator}
   */
  clone() {
    return /** @type {PathArgValidator} */ (super.clone());
  }

  /**
   * @private
   * @param {string} entry
   *
   * @returns {string}
   */
  _getParentDir(entry) {
    let parentDir;
    const arr = entry.split('/');
    if (1 === arr.length) {
      parentDir = os.getcwd()[0];
    } else {
      arr.pop();
      parentDir = arr.join('/');
    }
    return parentDir;
  }

  /**
   * @private
   * @param {string} entry
   * @param {boolean} isDir
   *
   * @returns {boolean}
   */
  _checkPath(entry, isDir) {
    const [obj, err] = os.stat(entry);
    if (err) {
      return false;
    }
    if (isDir && (notNull(obj).mode & os.S_IFDIR) !== os.S_IFDIR) {
      return false;
    }
    return true;
  }

  /**
   * @private
   * @param {string} dir
   *
   * @returns {number}
   */
  _ensureDir(dir) {
    const dirs = [];
    const parts = dir.split('/');
    while (parts.length > 0) {
      const parentDir = parts.join('/');
      parts.pop();
      if (!this._checkPath(parentDir, true)) {
        dirs.unshift(parentDir);
        continue;
      }
      break;
    }
    for (const dir of dirs) {
      const errCode = os.mkdir(dir);
      if (errCode < 0) {
        return -errCode;
      }
    }
    return 0;
  }

  /**
   * @private
   * @param {string} filepath
   *
   * @returns {string}
   * @throws {Error} if file content cannot be read
   */
  _readFile(filepath) {
    if (filepath === '-') {
      return std.in.readAsString();
    }
    const content = std.loadFile(filepath);
    if (content === null) {
      throw new Error('could not read file content');
    }
    return content;
  }

  /**
   * @protected
   * @param {string} rawValue
   *
   * @returns {string}
   * @throws {ArgError}
   */
  _parseValue(rawValue) {
    return this._trim ? rawValue.trim() : rawValue;
  }
}

/**
 * @class
 * @extends {ArgValidatorWithValue}
 */
class NumberArgValidator extends ArgValidatorWithValue {
  /**
   * @param {number} [defaultValue]
   */
  constructor(defaultValue) {
    super('number', defaultValue);
  }

  /**
   * Set default value
   *
   * @param {number|undefined} defaultValue
   *
   * @return {this}
   * @throws {Error} if "defaultValue" is not a number
   */
  def(defaultValue) {
    if (defaultValue !== undefined) {
      if (typeof defaultValue !== 'number') {
        throw new Error("Argument 'defaultValue' should be a number");
      }
    }
    this._defaultValue = defaultValue;
    return this;
  }

  /**
   * @param {ValueValidatorFunc<number>} customCb
   */
  cust(customCb) {
    return super.cust(customCb);
  }

  /**
   * @param {ValueMapper<number>} mapValueCb
   */
  map(mapValueCb) {
    return super.map(mapValueCb);
  }

  /**
   * @returns {this}
   * @throws {Error} if number is not positive
   */
  pos(isPositive = true) {
    if (typeof isPositive !== 'boolean') {
      throw new Error("Argument 'isPositive' should be a boolean");
    }
    this.setValidator(
      ValueValidatorType.IS_POSITIVE,
      /** @type {ValueValidatorFunc<number>} */ (value) => {
        if (value <= 0 && isPositive) {
          throw new Error(`it should be a positive number`);
        } else if (value > 0 && !isPositive) {
          throw new Error(`it should not be a positive number`);
        }
      }
    );
    return this;
  }

  /**
   * @param {boolean} [isNegative=true]
   *
   * @returns {this}
   * @throws {Error} if number is not negative
   */
  neg(isNegative = true) {
    if (typeof isNegative !== 'boolean') {
      throw new Error("Argument 'isNegative' should be a boolean");
    }
    this.setValidator(
      ValueValidatorType.IS_NEGATIVE,
      /** @type {ValueValidatorFunc<number>} */ (value) => {
        if (value >= 0 && isNegative) {
          throw new Error(`it should be a negative number`);
        } else if (value < 0 && !isNegative) {
          throw new Error(`it should not be a negative number`);
        }
      }
    );
    return this;
  }

  /**
   * @param {number} minValue
   *
   * @returns {this}
   * @throws {Error} if number is less than "minValue"
   */
  min(minValue) {
    if (typeof minValue !== 'number') {
      throw new Error("Argument 'min' should be number");
    }
    this.setValidator(
      ValueValidatorType.MIN,
      /** @type {ValueValidatorFunc<number>} */ (value) => {
        if (value < minValue) {
          throw new Error(`it should be a number >= ${minValue}`);
        }
      }
    );
    return this;
  }

  /**
   * @param {number} maxValue
   *
   * @returns {this}
   * @throws {Error} if number is greater than "maxValue"
   */
  max(maxValue) {
    if (typeof maxValue !== 'number') {
      throw new Error("Argument 'max' should be number");
    }
    this.setValidator(
      ValueValidatorType.MAX,
      /** @type {ValueValidatorFunc<number>} */ (value) => {
        if (value > maxValue) {
          throw new Error(`it should be a number <= ${maxValue}`);
        }
      }
    );
    return this;
  }

  /**
   * @returns {this}
   * @throws {Error} if number is not an integer
   */
  int() {
    this.setValidator(
      ValueValidatorType.IS_INT,
      /** @type {ValueValidatorFunc<number>} */ (value) => {
        const result = isValidInteger(value.toString());
        if (!result) {
          throw new Error('it should be an integer');
        }
      }
    );
    return this;
  }

  /**
   * Retrieve the text which will be displayed after argument names in usage
   *
   * @returns {string}
   */
  getValueText() {
    if (this._valueText) {
      return this._valueText;
    }
    return 'NUM';
  }

  /**
   * Return an object describing usage
   *
   * @param {string} argName
   * @param {boolean} allowMany - whether or not argument can be set multiple times
   * @param {string[]} aliases - list of aliases for this argument (can be empty)
   *
   * @returns {DescribeUsageItem}
   */
  describeUsage(argName, allowMany, aliases) {
    const output = super.describeUsage(argName, allowMany, aliases);
    output.type = 'number';
    return output;
  }

  /**
   * @returns {NumberArgValidator}
   */
  clone() {
    return /** @type {NumberArgValidator} */ (super.clone());
  }

  /**
   * @protected
   * @param {string} rawValue
   *
   * @returns {number}
   * @throws {ArgError}
   */
  _parseValue(rawValue) {
    const value = Number(rawValue);
    if (isNaN(value)) {
      throw new Error('it should be a number');
    }
    return value;
  }
}

/**
 * @class
 * @extends {ArgValidator}
 */
class FlagArgValidator extends ArgValidator {
  /**
   * @param {boolean} [defaultValue=false]
   */
  constructor(defaultValue = false) {
    super('boolean', defaultValue);

    /**
     * @private
     * @type {boolean}
     */
    this._allowNoFlag = true;

    /**
     * @private
     * @type {boolean}
     */
    this._count = false;
  }

  /**
   * Whether or not --no-x flag version should be allowed
   * Allowed by default
   *
   * @param {boolean} [allow=true]
   *
   * @returns {this}
   */
  no(allow = true) {
    if (typeof allow !== 'boolean') {
      throw new Error("Argument 'allow' should be a boolean");
    }
    this._allowNoFlag = allow;
    return this;
  }

  /**
   * Return the number of times flag was set at the end of validation
   *
   * @returns {this}
   */
  count() {
    this._count = true;
    return this;
  }

  /**
   * Set default value
   *
   * @param {boolean|undefined} defaultValue
   *
   * @return {this}
   * @throws {Error} if "defaultValue" is not a boolean
   */
  def(defaultValue) {
    if (defaultValue !== undefined) {
      if (typeof defaultValue !== 'boolean') {
        throw new Error("Argument 'defaultValue' should be a boolean");
      }
    }
    this._defaultValue = defaultValue;
    return this;
  }

  /**
   * @param {ValueValidatorFunc<boolean>} customCb
   */
  cust(customCb) {
    return super.cust(customCb);
  }

  /**
   * @param {ValueMapper<boolean>} mapValueCb
   */
  map(mapValueCb) {
    return super.map(mapValueCb);
  }

  /**
   * Return an object describing usage
   *
   * @param {string} argName
   * @param {boolean} allowMany - whether or not argument can be set multiple times
   * @param {string[]} aliases - list of aliases for this argument (can be empty)
   *
   * @returns {DescribeUsageItem}
   */
  describeUsage(argName, allowMany, aliases) {
    const output = super.describeUsage(argName, allowMany, aliases);
    output.type = 'flag';
    output.allowNoFlags = this._allowNoFlag;
    return output;
  }

  /**
   * @returns {FlagArgValidator}
   */
  clone() {
    return /** @type {FlagArgValidator} */ (super.clone());
  }

  /**
   * @protected
   * @param {string} rawValue
   *
   * @returns {boolean}
   * @throws {ArgError}
   */
  _parseValue(rawValue) {
    if (rawValue === 'true') {
      return true;
    } else if (rawValue === 'false') {
      return false;
    }
    throw new Error('it should be true or false');
  }
}

arg.str = (/** @type {string|undefined} */ defaultValue) =>
  new StringArgValidator(defaultValue);
arg.num = (/** @type {number|undefined} */ defaultValue) =>
  new NumberArgValidator(defaultValue);
arg.path = (/** @type {string|undefined} */ defaultValue) =>
  new PathArgValidator(defaultValue);
arg.flag = (/** @type {boolean|undefined} */ defaultValue) =>
  new FlagArgValidator(defaultValue);

// Utility types
arg.COUNT = arg.flag().count();

/**
 * @callback FormatValidatorFunc
 * @param {string} argValue
 *
 * @returns {boolean}
 */

/**
 * Register a named format
 *
 * @param {string} format
 * @param {RegExp|FormatValidatorFunc} validator
 */
arg.registerFormat = (format, validator) => {
  formats[format] = validator;
};

/**
 * @typedef {Object} ArgParserOptions
 * @property {ArgUsageLayoutOptions} [usageLayout]
 * @property {string[]} [helpFlags=["--help","-h"]] - list of flags to display help
 * @property {string[]} [versionFlags=["--version"]] - list of flags to display version
 * @property {boolean} [capitalizeUsage=false] - if set to true, capitalize usage for --help and --version messages
 * @property {string} [scriptName] - script name to use when displaying usage
 */

/**
 * @class
 */
class ArgParser {
  /**
   * @param {ArgSpecs} specs
   */
  constructor(specs) {
    /**
     * @private
     * @type {ArgSpecs}
     */
    this._specs = specs;

    /**
     * @private
     * @type {string|undefined}
     */
    this._description = undefined;

    /**
     * @private
     * @type {string[]}
     */
    this._examples = [];

    /**
     * @private
     * @type {string|undefined}
     */
    this._version = undefined;
  }

  /**
   * @param {string} description - script description
   *
   * @returns {this}
   * @throws {Error} if "description" is not a string
   */
  desc(description) {
    if (typeof description !== 'string') {
      throw new Error("Argument 'description' should be a string");
    }
    this._description = description.trim();
    return this;
  }

  /**
   * @param {string[]} examples
   *
   * @returns {this}
   * @throws {Error} if "examples" is an Array of strings
   */
  ex(examples) {
    if (!Array.isArray(examples)) {
      throw new Error("Argument 'list' should be an array");
    }
    for (const example of examples) {
      if (typeof example !== 'string') {
        throw new Error(
          `Argument 'examples' should be an array of strings (${example})`
        );
      }
      const str = example.trim();
      this._examples.push(str);
    }
    return this;
  }

  /**
   * @param {string} version
   *
   * @returns {this}
   * @throws {Error} if "version" is not a string
   */
  ver(version) {
    if (typeof version !== 'string') {
      throw new Error("Argument 'version' should be a string");
    }
    if (version) {
      this._version = version.trim();
    }
    return this;
  }

  /**
   * @param {ArgParserOptions} [options]
   *
   * @returns {ArgOutput}
   */
  parse(options = {}) {
    return arg(this._specs, {
      help: {
        enabled: true,
        description: this._description,
        examples: this._examples,
        flags: options.helpFlags,
        capitalizeUsage: options.capitalizeUsage,
      },
      usage: {
        enabled: true,
        layout: options.usageLayout,
      },
      version: this._version
        ? {
            enabled: true,
            version: this._version,
            flags: options.versionFlags,
            capitalizeUsage: options.capitalizeUsage,
          }
        : undefined,
      scriptName: options.scriptName,
    });
  }
}

/**
 * @param {ArgSpecs} specs
 *
 * @returns {ArgParser}
 */
arg.parser = (specs) => new ArgParser(specs);

/**
 * Build a string to represent a flag (which can be on or off)
 *
 * @param {string} argName
 * @param {boolean} addNoFlag - if {true}, add "--no-x" flag
 *
 * @returns {string}
 */
const serializeFlagName = (argName, addNoFlag) => {
  if (!argName.startsWith('--') || !addNoFlag) {
    return argName;
  }
  return `--(no-)${argName.substring(2)}`;
};

/**
 * Build a string containing the list of possible names for an argument
 *
 * @param {string} argName
 * @param {boolean} isFlag
 * @param {Object} [options]
 * @param {string[]} [options.aliases]
 * @param {string} [options.valueText="VAL"]
 * @param {boolean} [options.addNoFlag=true] - if {true}, add "--no-x" flag
 *
 * @returns {string}
 */
const serializeArgNames = (argName, isFlag, options = {}) => {
  const longNames = [];
  const shortNames = [];
  for (const name of [argName, ...(options.aliases ?? [])]) {
    let names = name.startsWith('--') ? longNames : shortNames;
    if (isFlag) {
      names.unshift(serializeFlagName(name, options.addNoFlag !== false));
    } else {
      names.unshift(name);
    }
  }
  // always display short arguments first
  const str = [...shortNames, ...longNames].join(', ');
  if (isFlag) {
    return str;
  }
  return `${str} ${options.valueText ?? DEFAULT_USAGE_VALUE_TEXT}`;
};

/**
 * Return the list of aliases for each main argument
 * (ie: one which is not an alias)
 *
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 *
 * @return {Record<string,string[]>}
 */
const getAliasesMap = (handlers, aliases) => {
  /** @type {Record<string,string[]>} */
  const aliasesMap = {};
  for (let [aliasName, argName] of Object.entries(aliases)) {
    argName = getMainArgName(argName, aliases);
    if (!(argName in handlers)) {
      continue;
    }
    if (!aliasesMap[argName]) {
      aliasesMap[argName] = [];
    }
    if (!aliasesMap[argName].includes(aliasName)) {
      aliasesMap[argName].push(aliasName);
    }
  }
  return aliasesMap;
};

/**
 * Return usage content
 *
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 * @param {Required<ArgHelpOptions>} helpOptions
 * @param {Required<ArgVersionOptions>} versionOptions
 * @param {Required<ArgUsageLayoutOptions>} usageLayoutOptions
 * @param {string} scriptName
 *
 * @returns {string}
 */
const getUsage = (
  handlers,
  aliases,
  helpOptions,
  versionOptions,
  usageLayoutOptions,
  scriptName
) => {
  let content = `Usage: ${scriptName} [ARG] ...`;

  /** @type {Record<string,string[]>} */
  const aliasesMap = getAliasesMap(handlers, aliases);

  let argNameIndent = '';
  if (usageLayoutOptions.argNameIndent) {
    argNameIndent = ''.padEnd(usageLayoutOptions.argNameIndent);
  }
  let maxLengthForArgNames = 0;

  /** @type {string[]} */
  const argNamesLines = [];
  const keys = Object.keys(handlers);
  for (const key of keys) {
    const [_type, _isFlag, allowMany, argValidator] = handlers[key];
    const isFlag = _isFlag || argValidator instanceof FlagArgValidator;

    let valueText = undefined;
    let addNoFlag = true;
    if (!isFlag) {
      valueText = DEFAULT_USAGE_VALUE_TEXT;
      if (argValidator instanceof ArgValidatorWithValue) {
        valueText = argValidator.getValueText();
      }
    } else {
      if (
        argValidator instanceof FlagArgValidator &&
        !(/** @type {any} */ (argValidator)._allowNoFlag)
      ) {
        addNoFlag = false;
      }
    }

    let line =
      argNameIndent +
      serializeArgNames(key, isFlag, {
        aliases: aliasesMap[key],
        valueText,
        addNoFlag,
      });
    if (allowMany) {
      line += ' (+)';
    }
    if (argValidator?.isRequired()) {
      line += ' (*)';
    }
    if (line.length > maxLengthForArgNames) {
      maxLengthForArgNames = line.length;
    }
    argNamesLines.push(line);
  }

  // handle help and version flags
  /** @type {string|undefined} */
  let helpArgNames = undefined;
  if (helpOptions.enabled) {
    helpArgNames =
      argNameIndent +
      serializeArgNames(helpOptions.flags[0], true, {
        aliases: helpOptions.flags.slice(1),
        addNoFlag: false,
      });
    if (helpArgNames.length > maxLengthForArgNames) {
      maxLengthForArgNames = helpArgNames.length;
    }
  }
  /** @type {string|undefined} */
  let versionArgNames = undefined;
  if (versionOptions.enabled) {
    versionArgNames =
      argNameIndent +
      serializeArgNames(versionOptions.flags[0], true, {
        aliases: versionOptions.flags.slice(1),
        addNoFlag: false,
      });
    if (versionArgNames.length > maxLengthForArgNames) {
      maxLengthForArgNames = versionArgNames.length;
    }
  }

  // add usage
  const usageIndent = ''.padEnd(
    maxLengthForArgNames +
      usageLayoutOptions.usageIndent +
      ARG_NAME_USAGE_SEPARATOR.length
  );
  const maxLengthForUsage = usageLayoutOptions.maxLength - usageIndent.length;
  const usageLines = [];
  for (const [index, key] of keys.entries()) {
    const [_type, _isFlag, allowMany, argValidator] = handlers[key];
    const argNames = argNamesLines[index].padEnd(maxLengthForArgNames);
    /** @type {string[]|undefined} */
    let usage;
    if (!argValidator) {
      if (allowMany) {
        usage = formatGeneratedUsageMessage(
          MESSAGE_ARG_MULTIPLE,
          maxLengthForUsage
        );
      }
    } else {
      usage = argValidator.getUsage({
        maxLength: maxLengthForUsage,
        allowMany,
      });
    }
    if (!usage?.length) {
      usageLines.push(argNames);
      continue;
    }
    usageLines.push(
      `${argNames}${''.padEnd(
        usageLayoutOptions.usageIndent
      )}${ARG_NAME_USAGE_SEPARATOR}${usage.shift()}`
    );
    for (const line of usage) {
      usageLines.push(`${usageIndent}${line}`);
    }
  }

  // handle help and version flags
  if (helpArgNames) {
    helpArgNames = helpArgNames.padEnd(maxLengthForArgNames);
    usageLines.push(
      `${helpArgNames}${''.padEnd(
        usageLayoutOptions.usageIndent
      )}${ARG_NAME_USAGE_SEPARATOR}${getHelpUsage(helpOptions.capitalizeUsage)}`
    );
  }
  if (versionArgNames) {
    versionArgNames = versionArgNames.padEnd(maxLengthForArgNames);
    usageLines.push(
      `${versionArgNames}${''.padEnd(
        usageLayoutOptions.usageIndent
      )}${ARG_NAME_USAGE_SEPARATOR}${getVersionUsage(
        versionOptions.capitalizeUsage
      )}`
    );
  }

  if (usageLines.length) {
    content += `\n\n${usageLines.join('\n')}`;
  }
  return content;
};

/**
 * Return help content
 *
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 * @param {Required<ArgHelpOptions>} helpOptions
 * @param {Required<ArgVersionOptions>} versionOptions
 * @param {Required<ArgUsageLayoutOptions>} usageLayoutOptions
 * @param {string} scriptName
 *
 * @returns {string}
 */
const getHelp = (
  handlers,
  aliases,
  helpOptions,
  versionOptions,
  usageLayoutOptions,
  scriptName
) => {
  let content = splitParagraph(
    helpOptions.description ?? '',
    usageLayoutOptions.maxLength
  ).join('\n');
  if (content) {
    content += '\n\n';
  }
  content += getUsage(
    handlers,
    aliases,
    helpOptions,
    versionOptions,
    usageLayoutOptions,
    scriptName
  );
  if (helpOptions.examples.length) {
    content += '\n\n';
    content += `EXAMPLES\n`;
    for (const example of helpOptions.examples) {
      content += `\n$ ${scriptName} ${example.trim()}\n`;
    }
  }
  return content.trim();
};

/**
 * @param {string} name
 * @param {DescribeUsageItemType} type
 * @param {boolean} allowMany
 * @param {boolean} allowNoFlags
 * @param {string[]} [aliases]
 *
 * @returns {DescribeUsageItem}
 */
const createUsageItem = (name, type, allowMany, allowNoFlags, aliases) => {
  /** @type {DescribeUsageItem} */
  const item = {
    name,
    type,
    required: false,
    valueText: '',
    allowMany,
    description: '',
    shortDescription: '',
    values: [],
    format: '',
    varName: '',
    aliases: aliases ?? [],
    allowNoFlags,
  };
  if (type === 'flag') {
    item.default = false;
  }
  return item;
};

/**
 * Return an Object[] describing usage
 *
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 * @param {Required<ArgHelpOptions>} helpOptions
 * @param {Required<ArgVersionOptions>} versionOptions
 *
 * @returns {DescribeUsageOutput}
 */
const describeUsage = (handlers, aliases, helpOptions, versionOptions) => {
  const aliasesMap = getAliasesMap(handlers, aliases);
  /** @type {DescribeUsageOutput} */
  const output = [];
  const keys = Object.keys(handlers);
  for (const key of keys) {
    const [type, isFlag, allowMany, argValidator] = handlers[key];
    if (argValidator) {
      output.push(
        argValidator.describeUsage(key, allowMany, aliasesMap[key] ?? [])
      );
      continue;
    }
    /** @type {'string'|'flag'|'number'} */
    let argType = isFlag ? 'flag' : 'string';
    if (type === Number) {
      argType = 'number';
    }
    output.push(
      createUsageItem(key, argType, allowMany, isFlag, aliasesMap[key])
    );
  }
  if (helpOptions.enabled) {
    const item = createUsageItem(
      helpOptions.flags[0],
      'flag',
      false,
      false,
      helpOptions.flags.slice(1)
    );
    item.description = getHelpUsage(helpOptions.capitalizeUsage);
    item.shortDescription = item.description.split('\n')[0];
    output.push(item);
  }
  if (versionOptions.enabled) {
    const item = createUsageItem(
      versionOptions.flags[0],
      'flag',
      false,
      false,
      versionOptions.flags.slice(1)
    );
    item.description = getVersionUsage(versionOptions.capitalizeUsage);
    item.shortDescription = item.description.split('\n')[0];
    output.push(item);
  }
  return output;
};
