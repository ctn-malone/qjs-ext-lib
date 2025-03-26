/** @format */
// @ts-check

import * as std from '../std.js';
import * as os from '../os.js';
import * as path from '../path.js';
import {
  findHandlers,
  parseCmdLine,
  findHandler,
  FlagArgValidator,
  ArgValidator,
  StringArgValidator,
  PathArgValidator,
  getAliasesMap,
  getMainArgName,
} from './arg.js';
import { Process } from '../process.js';

export const DEFAULT_COMPLETION_SHELL = 'bash';

/** @typedef {import('./arg.js').CmdLinePart} CmdLinePart */
/** @typedef {import('./arg.js').Handlers} Handlers */
/** @typedef {import('./arg.js').FindHandlersOutput} FindHandlersOutput */

/**
 * @callback SerializeFunction
 *
 * @returns {string | undefined}
 */

/**
 * @callback LogFunction
 * @param {SerializeFunction} serializer
 *
 * @returns {void}
 */

/**
 * @typedef {() => Promise<string[]>} DefaultCompletionCallback
 */

/**
 * @callback CustomCompletionCallback
 * @param {string} content
 * @param {DefaultCompletionCallback} defaultCompletion
 * @returns {Promise<string[]>}
 */

/** @type {LogFunction | undefined} */
let logFunction = undefined;
/** @type {std.StdFile | null} */
let debugFile = null;

/**
 * @param {string} [debugFilePath]
 *
 * @returns {LogFunction}
 */
export const createLogger = (debugFilePath) => {
  if (debugFile !== null) {
    debugFile.close();
    debugFile = null;
  }
  debugFile = debugFilePath ? std.open(debugFilePath, 'a') : null;
  if (debugFile !== null) {
    logFunction = (serializer) => {
      const message = serializer();
      if (message === undefined) return;
      /** @type {std.StdFile} */ (debugFile).puts(`${message}\n`);
    };
  } else {
    logFunction = () => {};
  }
  return logFunction;
};

/**
 * @param {number} code
 */
export const abortCompletion = (code) => {
  if (logFunction !== undefined) {
    logFunction(() => '======');
    if (debugFile !== null) {
      debugFile.close();
    }
  }
  std.exit(code);
};

/**
 * Check whether a token is an argument
 *
 * @param {CmdLinePart} [token]
 *
 * @returns {boolean}
 */
export const maybeArgument = (token) => {
  if (!token) return false;
  return token.content.startsWith('-');
};

/**
 * @param {CmdLinePart[]} tokens
 *
 * @returns {CmdLinePart[]}
 */
export const findMaybeArguments = (tokens) => {
  return tokens.filter(maybeArgument);
};

/**
 * @param {string[]} words
 * @param {string} [content]
 *
 * @returns {{matches: string[], exactMatch?: string}}
 */
export const findMatching = (words, content) => {
  const matches = [];
  let exactMatch = undefined;
  for (const word of words) {
    if (!content) {
      matches.push(word);
      continue;
    }
    if (word.startsWith(content)) {
      matches.push(word);
      if (word === content) {
        exactMatch = word;
      }
    }
  }
  return { matches, exactMatch };
};

/**
 * Split a command line into an array of arguments
 * Any argument matching --xy=z will be converted to
 * two distinct arguments
 *
 * @param {string} cmdLine
 *
 * @returns {CmdLinePart[]}
 */
export const getTokens = (cmdLine) => {
  /** @type {CmdLinePart[]} */
  const finalTokens = [];
  const tokens = parseCmdLine(cmdLine);
  for (const token of tokens) {
    if (!token.content.startsWith('--')) {
      finalTokens.push(token);
      continue;
    }
    const pos = token.content.indexOf('=');
    if (pos === -1) {
      finalTokens.push(token);
      continue;
    }

    const argValue = token.content.slice(pos + 1);

    // add token without value
    token.content = token.content.slice(0, pos);
    token.quoteChar = null;
    token.endingQuote = false;
    finalTokens.push(token);

    /*
      Add a new token with the value
      This does not change the index of the next token since '=' ~ ' '
     */
    /** @type {CmdLinePart} */
    const newToken = {
      content: argValue,
      index: token.index + token.content.length + 1,
      quoteChar: null,
      endingQuote: false,
    };
    if (newToken.content.startsWith("'") || newToken.content.startsWith('"')) {
      newToken.quoteChar = newToken.content.slice(0, 1);
      newToken.content = newToken.content.slice(1);
      if (newToken.content.endsWith("'") || newToken.content.endsWith('"')) {
        newToken.content = newToken.content.slice(0, -1);
        newToken.endingQuote = true;
      }
    }
    finalTokens.push(newToken);
  }
  return finalTokens;
};

/**
 * @param {CmdLinePart[]} tokens
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 *
 * @returns {string[]}
 */
const findUsedMainArgNames = (tokens, handlers, aliases) => {
  const maybeArgs = findMaybeArguments(tokens);
  if (!maybeArgs.length) {
    return [];
  }
  const argNames = maybeArgs.map((e) => e.content);
  const usedHandlers = findHandlers(argNames, handlers, aliases);
  /** @type {string[]} */
  const list = [];
  for (const item of Object.values(usedHandlers)) {
    if (!list.includes(item.argName)) {
      list.push(item.argName);
    }
  }
  return list;
};

/**
 * @typedef {Object} FindUnusedMainArgNamesOptions
 * @property {boolean} [includeAllowManyHandlers=true] - if true, also include handlers which can be set multiple times
 *                                                        even if they have already been used (default = false)
 */

/**
 * @param {Handlers} handlers
 * @param {string[]} usedMainArgNames
 * @param {FindUnusedMainArgNamesOptions} [options]
 *
 * @returns {string[]}
 */
const findUnusedMainArgNames = (handlers, usedMainArgNames, options) => {
  const { includeAllowManyHandlers = true } = options || {};
  const list = [];
  for (const [argName, handler] of Object.entries(handlers)) {
    if (usedMainArgNames.includes(argName)) {
      if (includeAllowManyHandlers) {
        const [_type, _isFlag, allowMany, _argValidator] = handler;
        if (allowMany) {
          list.push(argName);
        }
      }
      continue;
    }
    list.push(argName);
  }
  return list;
};

/**
 * @param {string[]} list
 * @param {CmdLinePart} [curToken]
 *
 * @returns {string[]}
 */
export const quoteBashCompletions = (list, curToken) => {
  let quotedList = list;
  quotedList = list.map((str) => {
    if (str.includes(' ')) {
      let quoteChar = curToken?.quoteChar || '"';
      return `${quoteChar}${str}${quoteChar}`;
    }
    return str;
  });
  return quotedList;
};

/**
 * @param {string} argName
 *
 * @return {string}
 */
const getNoFlagArgName = (argName) => {
  return `--no-${argName.substring('--'.length)}`;
};

/**
 * @typedef {Object} CompleteArgNamesOptions
 * @property {boolean} [includeAliases=true] - if true, also include aliases (default = true)
 */

/**
 * @param {LogFunction} debug
 * @param {string[]} argNames
 * @param {Handlers} handlers
 * @param {ReturnType<getAliasesMap>} aliasesMap
 * @param {CompleteArgNamesOptions} [options]
 *
 * @return {string[]}
 */
const completeArgNames = (debug, argNames, handlers, aliasesMap, options) => {
  const { includeAliases = true } = options || {};
  /** @type {string[]} */
  const list = [...argNames];
  for (const argName of argNames) {
    const [_type, isFlag, _allowMany, argValidator] = handlers[argName];
    let supportNoFlag = false;
    if (isFlag) {
      supportNoFlag = true;
      if (argName.startsWith('--')) {
        const noArgName = getNoFlagArgName(argName);
        if (!list.includes(noArgName)) {
          list.push(noArgName);
        }
      }
    } else if (argValidator instanceof FlagArgValidator) {
      if (/** @type {any} */ (argValidator)._allowNoFlag) {
        supportNoFlag = true;
        const noArgName = getNoFlagArgName(argName);
        if (!list.includes(noArgName)) {
          list.push(noArgName);
        }
      }
    }
    if (!includeAliases || !aliasesMap.hasOwnProperty(argName)) {
      continue;
    }
    for (const alias of aliasesMap[argName]) {
      list.push(alias);
      if (supportNoFlag) {
        if (alias.startsWith('--')) {
          const noArgName = getNoFlagArgName(argName);
          if (!list.includes(noArgName)) {
            list.push(noArgName);
          }
        }
      }
    }
  }
  return list;
};

/**
 * @typedef {Object} CompleteCmdLineOptions
 * @property {string} [completionShell] - (default = bash)
 * @property {boolean} [includeAliasesInArgNamesCompletion] - (default = true)
 * @property {string} [debugFilePath]
 */

/**
 * Perform completion for a given command line
 *
 * @param {string} cmdLine
 * @param {number} cursorPos
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 * @param {CompleteCmdLineOptions} [options]
 *
 * @return {Promise<string[]>} list of completions
 */
export const completeCmdLine = async (
  cmdLine,
  cursorPos,
  handlers,
  aliases,
  options
) => {
  const {
    completionShell = DEFAULT_COMPLETION_SHELL,
    includeAliasesInArgNamesCompletion = true,
    debugFilePath,
  } = options || {};
  const debug = createLogger(debugFilePath);

  // only keep a single space at the end
  cmdLine = cmdLine.replace(/[ ]+$/, ' ');

  const tokens = getTokens(cmdLine);

  /** @type {CmdLinePart | undefined} */
  let curToken = undefined;
  /** @type {number | undefined} */
  let curTokenIndex = undefined;

  for (const [index, token] of tokens.entries()) {
    if (token.index >= cursorPos) {
      break;
    }
    curToken = token;
    curTokenIndex = index;
  }

  const prevToken = tokens[/** @type {number} */ (curTokenIndex) - 1];

  const lastCmdlineChar = cmdLine[cursorPos - 1];
  const cmdLineEndsWithSpace =
    lastCmdlineChar === ' ' && !curToken?.content.endsWith(' ');

  /** @type {string[] | undefined} */
  let completions = undefined;
  let offerArguments = false;

  debug(() =>
    JSON.stringify(
      {
        curToken,
        prevToken,
        lastCmdlineChar,
      },
      null,
      2
    )
  );

  // if we're inside a subshell, don't complete
  if (curToken.content.startsWith('$(')) {
    debug(() => 'Inside a subshell (completion aborted)');
    return [];
  }

  if (cmdLineEndsWithSpace) {
    /*
      We need to list possible values for an argument
     */
    if (maybeArgument(curToken)) {
      debug(() => `Current token may be an argument (${curToken.content})`);
      const output = findHandler(curToken.content, handlers, aliases);
      if (!output) {
        debug(() => 'No handler found');
        return [];
      }

      const { handler } = output;
      const [_type, isFlag, allowMany, argValidator] = handler;
      debug(
        () =>
          `Found handler: ${JSON.stringify(
            {
              argName: output.argName,
              originalArgName: output.originalArgName,
              isFlag,
              allowMany,
              argValidator: argValidator?.constructor.name,
            },
            null,
            2
          )}`
      );

      if (isFlag || argValidator instanceof FlagArgValidator) {
        offerArguments = true;
      } else {
        completions = completeShellVariable(debug, curToken.content);
        if (!completions) {
          // without an ArgValidator we can do path completion
          if (!(argValidator instanceof ArgValidator)) {
            debug(() => `Path completion (${output.argName}) from ''`);
            completions = ['@@QEL_PATH@@'];
          } else {
            debug(
              () => `Argument value completion (${output.argName}) from ''`
            );
            completions = await completeArgValidatorValues(debug, argValidator);
          }
        }
      }
    } else {
      offerArguments = true;
    }
  } else {
    /*
      We need to complete a partial argument
     */
    if (maybeArgument(curToken)) {
      debug(
        () => `Current token may be a partial argument (${curToken.content})`
      );
      const usedMainArgNames = findUsedMainArgNames(tokens, handlers, aliases);
      const unusedMainArgNames = findUnusedMainArgNames(
        handlers,
        usedMainArgNames
      );
      const aliasesMap = getAliasesMap(handlers, aliases);

      let result = findMatching(
        completeArgNames(debug, unusedMainArgNames, handlers, aliasesMap, {
          includeAliases: includeAliasesInArgNamesCompletion,
        }),
        curToken.content
      );
      /*
        Even if we want to offer arguments which have not been used or can be set many times,
        we should offer an argument which has already been used if it is the only matching argument
       */
      if (!result.matches.length) {
        result = findMatching(
          completeArgNames(debug, usedMainArgNames, handlers, aliasesMap, {
            includeAliases: includeAliasesInArgNamesCompletion,
          }),
          curToken.content
        );
        if (result.matches.length !== 1) {
          result = { matches: [] };
        }
      }
      completions = result.matches;
      if (completionShell === 'zsh') {
        completions = addZshDescriptions(debug, completions, handlers, aliases);
      }

      /*
        We need to list possible values for an argument
       */
    } else if (maybeArgument(prevToken)) {
      debug(() => `Previous token may be an argument (${prevToken.content})`);
      const output = findHandler(prevToken.content, handlers, aliases);
      if (!output) {
        debug(() => 'No handler found');
        return [];
      }

      const { handler } = output;
      const [_type, isFlag, allowMany, argValidator] = handler;
      debug(
        () =>
          `Found handler: ${JSON.stringify(
            {
              argName: output.argName,
              originalArgName: output.originalArgName,
              isFlag,
              allowMany,
              argValidator: argValidator?.constructor.name,
            },
            null,
            2
          )}`
      );

      if (isFlag || argValidator instanceof FlagArgValidator) {
        offerArguments = true;
      } else {
        completions = completeShellVariable(debug, curToken.content);
        if (!completions) {
          // without an ArgValidator we can do path completion
          if (!(argValidator instanceof ArgValidator)) {
            debug(
              () =>
                `Path completion (${output.argName}) from '${curToken.content}'`
            );
            completions = ['@@QEL_PATH@@'];
          } else {
            debug(
              () =>
                `Argument value completion (${output.argName}) from '${curToken.content}'`
            );
            completions = await completeArgValidatorValues(
              debug,
              argValidator,
              curToken
            );
          }
        }
      }
    }
  }
  if (offerArguments) {
    const usedMainArgNames = findUsedMainArgNames(tokens, handlers, aliases);
    const unusedMainArgNames = findUnusedMainArgNames(
      handlers,
      usedMainArgNames
    );
    const aliasesMap = getAliasesMap(handlers, aliases);
    completions = completeArgNames(
      debug,
      unusedMainArgNames,
      handlers,
      aliasesMap,
      { includeAliases: includeAliasesInArgNamesCompletion }
    );
    if (completionShell === 'zsh') {
      completions = addZshDescriptions(debug, completions, handlers, aliases);
    }
  }

  if (completions?.length) {
    debug(() => {
      const _completions = /** @type {string[]} */ (completions);
      // maximum number of completion lines
      const maxLines = 15;
      // maximum length of a completion line
      const maxLength = 50;
      const list = _completions.slice(0, maxLines);
      if (_completions.length > maxLines) {
        list[maxLines - 1] = '...';
      }
      return `Completions: ${JSON.stringify(
        list.map((str) => {
          if (str.length > maxLength) {
            return `${str.substring(0, maxLength - 3)}...`;
          }
          return str;
        }),
        null,
        2
      )}`;
    });
    // quoting / escaping is only necessary for bash
    if (completionShell === 'bash') {
      completions = quoteBashCompletions(completions, curToken);
    }
  }

  return completions ?? [];
};

/**
 * @param {LogFunction} _debug
 * @param {string[]} completions
 * @param {Handlers} handlers
 * @param {Record<string, string>} aliases
 *
 * @returns {string[]}
 */
const addZshDescriptions = (_debug, completions, handlers, aliases) => {
  return completions.map((name) => {
    const mainArgName = getMainArgName(name, aliases);
    const [_type, _isFlag, _allowMany, argValidator] = handlers[mainArgName];
    /** @type {string | undefined} */
    let description = undefined;
    if (argValidator instanceof ArgValidator) {
      description = /** @type {any} */ (argValidator)._description;
      if (description) {
        description = description.replaceAll('\n', ' ');
      }
      const defaultValue = /** @type {any} */ (argValidator)._defaultValue;
      if (defaultValue) {
        description += `${description ? ' ' : ''}(default: ${defaultValue})`;
      }
    }
    if (!description) {
      return name;
    }
    return `${name}:${description}`;
  });
};

/**
 * @param {LogFunction} debug
 * @param {string | undefined} content
 *
 * @returns {string[] | undefined}
 */
const completeShellVariable = (debug, content) => {
  if (!content) {
    return undefined;
  }
  if (!content.startsWith('$')) {
    return undefined;
  }
  const matches = content.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)?$/);
  if (!matches) {
    return undefined;
  }
  debug(() => `Argument value completion (varName) from '${content}'`);
  const varName = matches[1];
  const matchingVars = Object.keys(std.getenviron()).filter((name) => {
    if (name === '_' || name.startsWith(' ')) {
      return false;
    }
    return !varName || name.startsWith(varName);
  });
  return matchingVars.map((name) => `$${name}`);
};

/**
 * @param {LogFunction} debug
 * @param {ArgValidator} argValidator
 * @param {CmdLinePart} [token]
 *
 * @returns {Promise<string[]>}
 */
const completeArgValidatorValues = async (debug, argValidator, token) => {
  const content = token?.content ?? '';
  const customCompletion = /** @type {CustomCompletionCallback | undefined} */ (
    /** @type {any} */ (argValidator)._customComplete
  );
  /** @type {string[] | undefined} */
  let output = undefined;

  try {
    if (argValidator instanceof StringArgValidator) {
      const words = /** @type {string[] | undefined} */ (
        /** @type {any} */ (argValidator)._enum
      );
      const defaultCompletion = async () => {
        if (!words?.length) {
          return [];
        }
        return findMatching(words, content).matches;
      };
      if (customCompletion) {
        debug(() => `Argument value completion (custom) from '${content}'`);
        output = await customCompletion(content, defaultCompletion);
      } else if (words?.length) {
        debug(() => `Argument value completion (enum) from '${content}'`);
        output = await defaultCompletion();
      }
    } else if (argValidator instanceof PathArgValidator) {
      const defaultCompletion = async () => {
        const isDir = /** @type {any} */ (argValidator)._isDir;
        return isDir ? ['@QEL_DIR@'] : ['@QEL_PATH@'];
      };
      if (customCompletion) {
        debug(() => `Argument value completion (custom) from '${content}'`);
        output = await customCompletion(content, defaultCompletion);
      } else {
        debug(() => `Argument value completion (path) from '${content}'`);
        output = await defaultCompletion();
      }
    } else {
      const defaultValue = /** @type {string|number|boolean|undefined} */ (
        /** @type {any} */ (argValidator)._defaultValue
      );
      const defaultCompletion = async () => {
        return defaultValue !== undefined ? [defaultValue.toString()] : [];
      };
      if (customCompletion) {
        debug(() => `Argument value completion (custom) from '${content}'`);
        output = await customCompletion(content, defaultCompletion);
      } else if (defaultValue !== undefined) {
        debug(() => `Argument value completion (default) from '${content}'`);
        output = await defaultCompletion();
      }
    }
  } catch (e) {
    debug(() => [e.message, e.stack].join('\n'));
  }

  return output ?? [];
};
