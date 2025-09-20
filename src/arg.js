/** @format */
// @ts-check
'use strict;';

import * as std from './std.js';
import * as os from './os.js';

import * as path from './path.js';
import {
  DEFAULT_USAGE_VALUE_TEXT,
  MESSAGE_ARG_MULTIPLE,
  getValueFromEnv,
  findHandler,
  registerFormat,
  ArgErrorCode,
  ArgError,
  ArgValidator,
  StringArgValidator,
  NumberArgValidator,
  PathArgValidator,
  FlagArgValidator,
  ArgValidatorWithValue,
  formatGeneratedUsageMessage,
  createUsageItem,
  splitParagraph,
  getAliasesMap,
  isCompletionNeeded,
} from './internal/arg.js';
import {
  DEFAULT_COMPLETION_SHELL,
  abortCompletion,
  completeCmdLine,
} from './internal/completion.js';

/*
  Based on https://github.com/vercel/arg/tree/5.0.0

  See the "Validators" section for the enhancements
 */

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
 * @property {() => void} [afterParse] - function which will be called once parsing is finished
 */

/**
 * @template T
 * @typedef {Extract<
 *   keyof T,
 *   {
 *     [K in keyof T]: T[K] extends NonAliasArgSpec
 *       ? (K extends `-${string}` ? K : never)
 *       : never
 *   }[keyof T]
 * >} KeysForNonAliasArgSpec
 */

/**
 * @template T
 * @typedef {(name: KeysForNonAliasArgSpec<T>) => boolean} HasValue
 */

/**
 * @template T
 * @typedef {(name: KeysForNonAliasArgSpec<T>, defaultValue?: any) => any} GetValueOrDefault
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
 * @typedef {ArgHandler|[ArgHandler]|ArgValidator|[ArgValidator]} NonAliasArgSpec
 */

/**
 * @typedef {NonAliasArgSpec|string} ArgSpec
 */

/**
 * @typedef {Record<`-${string}`, ArgSpec>} ArgSpecs
 */

/**
 * @typedef {import('./internal/arg.js').DescribeUsageItem} DescribeUsageItem
 */

/**
 * @typedef {DescribeUsageItem[]} DescribeUsageOutput
 */

/**
 * @template T
 * @typedef {Object} ArgOutput
 * @property {GetValueOrDefault<T>} get - try to get argument value and fallback to default
 * @property {HasValue<T>} has - check whether or not an argument is defined
 * @property {() => void} parse - parse arguments
 * @property {() => Promise<void>} checkCompletion - function which will wait if completion needs to be performed
 * @property {() => string} getUsage - return usage content
 * @property {() => DescribeUsageOutput} describeUsage - return an object describing usage
 * @property {(message?: string) => void} usage - output usage to stderr and exit with code 2
 * @property {() => string} getHelp - return help content
 * @property {() => void} help - output help to stderr and exit with code 0
 * @property {string[]} _ - extra arguments (positional and unknown)
 */

/**
 * @typedef {import('./internal/arg.js').Handlers} Handlers */

const DEFAULT_HELP_FLAGS = ['--help', '-h'];
const DEFAULT_VERSION_FLAGS = ['--version'];

/*
  String used to separate argument names and usage definition
 */
const ARG_NAME_USAGE_SEPARATOR = ': ';

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
  Text to display for help flag in usage
 */
const DEFAULT_USAGE_HELP_DESCRIPTION = 'print help';

/*
  Text to display for version flag in usage
 */
const DEFAULT_USAGE_VERSION_DESCRIPTION = 'print version';

/**
 * Parse arguments
 *
 * @template {ArgSpecs} T
 * @param {T} specs
 * @param {ArgOptions} [options]
 *
 * @returns {ArgOutput<T>}
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
    afterParse,
  } = options;

  let scriptName = options.scriptName;
  if (!scriptName) {
    scriptName = getValueFromEnv('QEL_SCRIPT_NAME');
  }
  if (!scriptName) {
    scriptName = path.getScriptName();
  }

  /** @type {ArgOutput<T>} */
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

    // @ts-ignore
    if (typeof specs[key] === 'string') {
      // @ts-ignore
      aliases[key] = specs[key];
      continue;
    }

    // @ts-ignore
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

  result.checkCompletion = () => {
    return new Promise((resolve) => {
      if (!isCompletionNeeded()) {
        resolve();
      }
    });
  };

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

            const output = findHandler(originalArgName, handlers, aliases);
            if (output === undefined) {
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
            const { argName, isNoflag, handler } = output;
            const [type, isFlag, _allowMany, argValidator] = handler;

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
                isFlag ? !isNoflag : (!isNoflag).toString(),
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

  /** @type {GetValueOrDefault<T>} */
  result.get = (name, defaultValue) => {
    // @ts-ignore
    if (result[name] === undefined) {
      return defaultValue;
    }
    // @ts-ignore
    return result[name];
  };

  /** @type {HasValue<T>} */
  result.has = (name) => {
    // @ts-ignore
    if (result[name] === undefined) {
      return false;
    }
    // @ts-ignore
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
   *
   * @return {never}
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
   *
   * @return {never}
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

  /*
    Completion
   */
  if (isCompletionNeeded()) {
    const cmdLine = /** @type {string} */ (getValueFromEnv('COMP_LINE'));
    let cursorPos = parseInt(
      /** @type {string} */ (getValueFromEnv('COMP_POINT'))
    );
    if (isNaN(cursorPos)) {
      cursorPos = cmdLine ? cmdLine.length - 1 : 0;
    } else {
      cursorPos = cursorPos;
    }

    const completionShell =
      getValueFromEnv('QEL_COMPLETION_SHELL') || DEFAULT_COMPLETION_SHELL;
    const includeAliasesInArgNamesCompletion = !['false', '0'].includes(
      getValueFromEnv('QEL_COMPLETION_INCLUDE_ARG_ALIASES') ?? 'true'
    );
    const debugFilePath = getValueFromEnv('QEL_COMPLETION_DEBUG');

    completeCmdLine(cmdLine, cursorPos, handlers, aliases, {
      completionShell,
      debugFilePath,
      includeAliasesInArgNamesCompletion,
    }).then((completions) => {
      if (completions.length) {
        std.out.puts(completions.join('\n'));
      }
      abortCompletion(0);
    });
    return result;
  } else if (
    getValueFromEnv('QEL_DESCRIBE_USAGE') !== undefined ||
    getValueFromEnv('DESCRIBE_USAGE') !== undefined
  ) {
    const output = describeUsage(
      handlers,
      aliases,
      helpOptions,
      versionOptions
    );
    std.out.puts(`${JSON.stringify(output, null, 2)}\n`);
    std.exit(0);
  } else {
    if (shouldParse) {
      result.parse();
    }
    if (afterParse) {
      os.setTimeout(() => {
        afterParse();
      }, 0);
    }
    return result;
  }
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

/** @type {(defaultValue?: string) => StringArgValidator} */
arg.str = (defaultValue) => new StringArgValidator(defaultValue);

/** @type {(defaultValue?: number) => NumberArgValidator} */
arg.num = (defaultValue) => new NumberArgValidator(defaultValue);

/** @type {(defaultValue?: string) => PathArgValidator} */
arg.path = (defaultValue) => new PathArgValidator(defaultValue);

/** @type {(defaultValue?: boolean) => FlagArgValidator} */
arg.flag = (defaultValue) => new FlagArgValidator(defaultValue);

// Utility types
arg.COUNT = arg.flag().count();

/**
 * @typedef {import('./internal/arg.js').FormatValidatorFunc} FormatValidatorFunc
 */

/**
 * Register a named format
 *
 * @param {string} format
 * @param {RegExp|FormatValidatorFunc} validator
 */
arg.registerFormat = registerFormat;

/**
 * @typedef {Object} ArgParserOptions
 * @property {ArgUsageLayoutOptions} [usageLayout]
 * @property {string[]} [helpFlags=["--help","-h"]] - list of flags to display help
 * @property {string[]} [versionFlags=["--version"]] - list of flags to display version
 * @property {boolean} [capitalizeUsage=false] - if set to true, capitalize usage for --help and --version messages
 * @property {string} [scriptName] - script name to use when displaying usage
 */

/**
 * @template {ArgSpecs} T
 * @class
 */
class ArgParser {
  /**
   * @param {T} specs
   */
  constructor(specs) {
    /**
     * @private
     * @type {T}
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
   * @private
   * @param {ArgParserOptions & {afterParse?: () => void}} [options]
   * @returns {ArgOutput<T>}
   */
  _parse(options = {}) {
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
      afterParse: options.afterParse,
    });
  }

  /**
   * @param {ArgParserOptions} [options]
   *
   * @returns {ArgOutput<T>}
   */
  parse(options = {}) {
    return this._parse(options);
  }

  /**
   * @param {ArgParserOptions} [options]
   *
   * @returns {Promise<ArgOutput<T>>}
   */
  async parseAsync(options = {}) {
    return new Promise((resolve) => {
      const output = this._parse({
        ...options,
        afterParse: () => {
          resolve(output);
        },
      });
    });
  }
}

/**
 * @template {ArgSpecs} T
 * @param {T} specs
 *
 * @returns {ArgParser<T>}
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
export const serializeFlagName = (argName, addNoFlag) => {
  if (!argName.startsWith('--') || !addNoFlag) {
    return argName;
  }
  return `--(no-)${argName.substring('--'.length)}`;
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
  /** @type {string[]} */
  const longNames = [];
  /** @type {string[]} */
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
