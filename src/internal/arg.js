/** @format */
// @ts-check

import * as os from '../os.js';
import * as std from '../std.js';

import { notNull } from '../types.js';

/*
  Parsing rules borrowed from https://github.com/ljharb/shell-quote/blob/main/parse.js

	  1. inside single quotes, all characters are printed literally.
		2. inside double quotes, all characters are printed literally
		   except variables prefixed by '$' and backslashes followed by
		   either a double quote or another backslash.
		3. outside of any quotes, backslashes are treated as escape
		   characters and not printed (unless they are themselves escaped)
		4. quote context can switch mid-token if there is no whitespace
		   between the two quote contexts (e.g. all'one'"token" parses as
		   "allonetoken")
 */

/**
 * @typedef {Object} CmdLinePart
 * @property {string} content
 * @property {number} index
 * @property {string|null} quoteChar
 * @property {boolean} endingQuote
 */

/**
 * Split a command line into an array of arguments, treating subshell expressions as single tokens
 *
 * @param {string} cmdLine
 *
 * @returns {CmdLinePart[]}
 */
export const parseCmdLine = (cmdLine) => {
  if (typeof cmdLine !== 'string') {
    throw new TypeError('cmdLine must be a string');
  }

  /** @type {CmdLinePart[]} */
  const tokens = [];
  let current = '';
  /** @type {'"' | "'" | null} */
  let currentQuoteChar = null;
  /** @type {'"' | "'" | null} */
  let mainQuoteChar = null;
  let isEscaped = false;
  // whether or not ending quote was found
  let endingQuote = false;
  // track subshell nesting level
  let subshellLevel = 0;
  let tokenIndex = 0;

  /**
   * @param {number} [currentIndex]
   */
  const addToken = (currentIndex) => {
    if (current || currentQuoteChar !== null) {
      tokens.push({
        content: current,
        index: tokenIndex,
        quoteChar: mainQuoteChar,
        endingQuote,
      });
      current = '';
      currentQuoteChar = null;
      mainQuoteChar = null;
      endingQuote = false;
      if (currentIndex) {
        tokenIndex = currentIndex + 1;
      }
    }
  };

  for (let i = 0; i < cmdLine.length; ++i) {
    const char = cmdLine[i];

    // handle escape character
    if (char === '\\') {
      if (isEscaped) {
        current += char;
        isEscaped = false;
      } else if (currentQuoteChar === "'") {
        // inside single quotes, all characters are printed literally
        current += char;
      } else {
        isEscaped = true;
      }
      continue;
    }

    // handle escaped characters
    if (isEscaped) {
      // for escaped $ particularly, we want to preserve the escape character
      if (char === '$') {
        current += '\\' + char;
      } else {
        current += char;
      }
      isEscaped = false;
      continue;
    }

    // check for subshell start (but only if not escaped)
    if (
      char === '$' &&
      i + 1 < cmdLine.length &&
      cmdLine[i + 1] === '(' &&
      !isEscaped
    ) {
      subshellLevel++;
      current += char;
      continue;
    }

    // track opening parenthesis for subshell
    if (char === '(' && i > 0 && cmdLine[i - 1] === '$' && subshellLevel > 0) {
      current += char;
      continue;
    }

    // track closing parenthesis for subshell
    if (char === ')' && subshellLevel > 0) {
      subshellLevel--;
      current += char;
      continue;
    }

    // handle quotes
    if ((char === '"' || char === "'") && subshellLevel === 0) {
      if (mainQuoteChar === null) {
        if (!current) {
          mainQuoteChar = char;
        }
        // --xy=...
        else if (current.startsWith('--') && current.endsWith('=')) {
          currentQuoteChar = char;
          current += char;
          continue;
        }
      }
      if (currentQuoteChar === null) {
        currentQuoteChar = char;
      } else if (char === currentQuoteChar) {
        currentQuoteChar = null;
        // this is an ending quote
        if (mainQuoteChar) {
          endingQuote = true;
        }
      } else {
        current += char;
      }
      continue;
    }

    // upon reaching a whitespace, add token only if we're not in a quote or subshell
    if (/\s/.test(char) && currentQuoteChar === null && subshellLevel === 0) {
      addToken(i);
      continue;
    }

    current += char;
  }

  if (isEscaped) {
    current += '\\';
  }

  addToken();
  return tokens;
};

/**
 * Retrieve the main argument corresponding to an alias (recursively)
 *
 * @param {string} aliasName
 * @param {Record<string,string>} aliases
 *
 * @returns {string}
 */
export const getMainArgName = (aliasName, aliases) => {
  if (aliasName.startsWith('--no-')) {
    aliasName = `--${aliasName.substring('--no-'.length)}`;
  }
  while (aliasName in aliases) {
    aliasName = aliases[aliasName];
  }
  return aliasName;
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
export const getAliasesMap = (handlers, aliases) => {
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
 * @typedef {Object} FindHandlerOutput
 * @property {string} argName
 * @property {string} originalArgName
 * @property {boolean} isNoflag
 * @property {Handler} handler
 */

/**
 * @param {string} argName - name of the argument (starting with - or --)
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 *
 * @returns {FindHandlerOutput|undefined}
 */
export const findHandler = (argName, handlers, aliases) => {
  const originalArgName = argName;
  let mainArgName = getMainArgName(argName, aliases);
  if (!(mainArgName in handlers)) {
    return undefined;
  }
  const isNoflag = originalArgName.startsWith('--no-');
  if (isNoflag) {
    // ignore if --no-x flag is not allowed
    const [_type, _isFlag, _allowMany, argValidator] = handlers[mainArgName];
    if (argValidator && !(/** @type {any} */ (argValidator)._allowNoFlag)) {
      return undefined;
    }
  }
  return {
    argName: mainArgName,
    originalArgName,
    isNoflag,
    handler: handlers[mainArgName],
  };
};

/**
 * @typedef {Record<string, FindHandlerOutput>} FindHandlersOutput
 */

/**
 * @param {string[]} argNames - names of the arguments (starting with - or --)
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 *
 * @returns {FindHandlersOutput}
 */
export const findHandlers = (argNames, handlers, aliases) => {
  /** @type {FindHandlersOutput} */
  const output = {};
  for (const argName of argNames) {
    const handler = findHandler(argName, handlers, aliases);
    if (handler) {
      output[argName] = handler;
    }
  }
  return output;
};

/**
 * Retrieve a value from environment
 *
 * @param {string|undefined} varName
 *
 * @returns {string|undefined}
 */
export const getValueFromEnv = (varName) => {
  if (varName === undefined) {
    return undefined;
  }
  return std.getenv(varName);
};

/**
 * Check whether or not completion is needed
 *
 * @returns  {boolean}
 */
export const isCompletionNeeded = () => {
  return (
    getValueFromEnv('COMP_LINE') !== undefined &&
    getValueFromEnv('COMP_POINT') !== undefined
  );
};

/**
 * @typedef {[Function, boolean, boolean, ArgValidator|undefined]} Handler
 */

/**
 * @typedef {Record<string, Handler>} Handlers
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
 * @property {boolean} allowNoFlags - whether or not --no- flags are supported for this flag (always false for non flags arguments)
 */

/**
 * @param {string} name
 * @param {DescribeUsageItemType} type
 * @param {boolean} allowMany
 * @param {boolean} allowNoFlags
 * @param {string[]} [aliases]
 *
 * @returns {DescribeUsageItem}
 */
export const createUsageItem = (
  name,
  type,
  allowMany,
  allowNoFlags,
  aliases
) => {
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
 * @readonly
 * @enum {string}
 */
export const ArgErrorCode = {
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

export class ArgError extends Error {
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

export const MESSAGE_ARG_MULTIPLE = 'it can be set multiple times';
const MESSAGE_FLAG_SET_BY_DEFAULT = 'set by default';

/*
  Text which will be displayed after argument names in usage
 */
export const DEFAULT_USAGE_VALUE_TEXT = 'VAL';

/*
  Message to display before enum values in usage
 */
const DEFAULT_USAGE_ENUM_MESSAGE = 'it can be one of';

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
export const splitParagraph = (paragraph, maxLength) => {
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
 * @callback FormatValidatorFunc
 * @param {string} argValue
 *
 * @returns {boolean}
 */

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
 * Register a named format
 *
 * @param {string} format
 * @param {RegExp|FormatValidatorFunc} validator
 */
export const registerFormat = (format, validator) => {
  formats[format] = validator;
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
export const formatGeneratedUsageMessage = (message, maxLength) => {
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
 * @param {string} value
 *
 * @returns {boolean}
 */
const isValidInteger = (value) => {
  return value !== undefined && !!value.match(/^[-+]?(\d+)$/);
};

/**
 * @abstract
 * @class
 */
export class ArgValidator {
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
 *  @typedef {import('./completion.js').CustomCompletionFunc} CustomCompletionFunc
 */

/**
 * @abstract
 * @class
 */
export class ArgValidatorWithValue extends ArgValidator {
  /**
   * @param {string} type
   * @param {string|number} [defaultValue]
   * @throws {Error} if defaultValue is of the wrong type
   */
  constructor(type, defaultValue) {
    super(type, defaultValue);

    /**
     * @private
     * @type {CustomCompletionFunc|undefined}
     */
    this._customComplete = undefined;
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
   * @param {CustomCompletionFunc} completeFn
   *
   * @returns {this}
   */
  comp(completeFn) {
    this._customComplete = completeFn;
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
export class StringArgValidator extends BaseStringArgValidator {
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
     * @type {{value: string, desc?: string}[]|undefined}
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
   * @param {(string | {value: string, desc?: string})[]} possibleValues
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
      if (typeof value !== 'string' && value.value === undefined) {
        throw new Error(
          `Argument 'enum' should be an array of strings or {value: string} objects (${value})`
        );
      }
    }
    message = message?.trim() || DEFAULT_USAGE_ENUM_MESSAGE;
    this._enum = possibleValues.map((e) => {
      if (typeof e === 'string') {
        return { value: e };
      }
      return e;
    });
    const values = /** @type {const} */ this._enum.map((e) => e.value);
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
      output.values = this._enum.map((e) => e.value);
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
export class PathArgValidator extends BaseStringArgValidator {
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
      os.close(fd);
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
export class NumberArgValidator extends ArgValidatorWithValue {
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
export class FlagArgValidator extends ArgValidator {
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
