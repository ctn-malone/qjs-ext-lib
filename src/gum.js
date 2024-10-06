/** @format */
// @ts-check

/*
  Simple wrappers to interact with gum, a tool for glamorous shell scripts

  See https://github.com/charmbracelet/gum

  Compatible with following gum versions

  - >= 0.12.0
 */

import * as os from './os.js';
import * as std from './std.js';

import { ProcessSync, Process } from './process.js';

/** @typedef {import('./process.js').ProcessState} ProcessState */

/**
 * Used for {input} and {write} functions
 *
 * @readonly
 * @enum {string}
 */
export const CursorMode = {
  BLINK: 'blink',
  HIDE: 'hide',
  STATIC: 'static',
};

/**
 * Used for {style} and {renderTable} functions
 *
 * @readonly
 * @enum {string}
 */
export const Border = {
  ROUNDED: 'rounded',
  THICK: 'thick',
  NORMAL: 'normal',
  HIDDEN: 'hidden',
  DOUBLE: 'double',
  NONE: 'none',
};

/**
 * Used for {style} and {join} functions
 *
 * @readonly
 * @enum {string}
 */
export const Align = {
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  BOTTOM: 'bottom',
  MIDDLE: 'middle',
  TOP: 'top',
};

/**
 * Default environment variables which are initialized
 * at the bottom of the file
 *
 * Variables can be overriden using {updateDefaultEnv} function
 *
 * @type {Record<string,string>}
 */
const defaultEnvironment = {};

/**
 * @param {ProcessSync} process
 */
const handleError = (process) => {
  if (process.exitCode !== 130) {
    throw new Error(process.stderr);
  }
  return undefined;
};

/**
 * @param {object} args - arguments to update
 * @param {object} [customArgs] - arguments to add to {args}
 * @param {string[]} [argsToIgnore] - arguments to ignore in {customArgs}, to ensure consistent behaviour
 */
const addCustomArguments = (args, customArgs, argsToIgnore) => {
  if (!customArgs) {
    return;
  }
  argsToIgnore = argsToIgnore || [];
  for (const [argName, argValue] of Object.entries(customArgs)) {
    if (argsToIgnore.includes(argName)) {
      continue;
    }
    args.push(`--${argName}`);
    if (argValue !== undefined) {
      args.push(argValue.toString());
    }
  }
};

/**
 * @param {Record<string,string|number>} [customEnv]
 * @param {string[]} [varsToIgnore] - variables to ignore in {customEnv}
 *
 * @returns {Record<string,string>}
 */
const getEnv = (customEnv, varsToIgnore) => {
  customEnv = customEnv || {};
  varsToIgnore = varsToIgnore || [];
  /** @type Record<string,string> */
  const env = {};
  for (const [varName, varValue] of Object.entries(defaultEnvironment)) {
    if (varsToIgnore.includes(varName)) {
      continue;
    }
    env[varName] = varValue;
  }
  for (const [varName, varValue] of Object.entries(customEnv)) {
    if (varsToIgnore.includes(varName)) {
      continue;
    }
    env[varName] = varValue.toString();
  }
  return env;
};

/**
 * Retrieve gum version
 *
 * @returns {string|undefined}
 */
export const getVersion = () => {
  const p = new ProcessSync('gum --version');
  if (!p.run()) {
    return undefined;
  }
  const matches = p.stdout.match(/v?(\d+\.\d+(?:\.\d+)*)/);
  if (!matches) {
    return undefined;
  }
  return matches[1];
};

/**
 * Indicates whether or not gum binary exists
 *
 * @returns {boolean}
 */
export const hasGum = () => {
  return getVersion() !== undefined;
};

/**
 * Override default gum environment variables (ex: colors)
 *
 * @param {Record<string,string|number>} env - environment variables
 */
export const updateDefaultEnv = (env) => {
  if (!env) {
    return;
  }
  for (const [varName, varValue] of Object.entries(env)) {
    defaultEnvironment[varName] = varValue.toString();
  }
};

/**
 * Retrieve default gum environment variables
 *
 * @returns {Record<string,string>}
 */
export const getDefaultEnv = () => {
  return { ...defaultEnvironment };
};

/**
 * @callback DryRunCallback
 * @param {string[]} cmdline
 * @param {Record<string,string>} env
 */

/**
 * @typedef {Object} CustomOptions
 * @property {Record<string, string|number>} [env] - custom environment variables
 * @property {Record<string, string|number|undefined>} [args] - custom arguments
 * @property {DryRunCallback} [dryRunCb] - only used for unit testing
 */

/**
 * @template [T=string]
 * @typedef {Object} ListItem
 * @property {string} text
 * @property {T} value
 */

/**
 * @template [T=string]
 * @param {ListItem<T>[]|string[]} list
 *
 * @returns {ListItem<T>[]}
 */
const buildItems = (list) => {
  /** @type {ListItem<T>[]} */
  const items = [];
  for (const item of list) {
    if (typeof item === 'object') {
      items.push({ text: item.text, value: item.value });
    } else {
      /** @type {any} */
      const listItem = { text: item, value: item };
      items.push(listItem);
    }
  }
  return items;
};

/**
 * @template [T=string]
 * @param {ListItem<T>[]} list
 * @param {string} value
 *
 * @returns {ListItem<T>|undefined}
 */
const findItem = (list, value) => {
  for (const item of list) {
    if (item.text === value) {
      return item;
    }
  }
};

/**
 * @template [T=string]
 * @param {ListItem<T>[]} list
 * @param {string[]} values
 *
 * @returns {ListItem<T>[]}
 */
const findItems = (list, values) => {
  const items = [];
  for (const value of values) {
    const item = findItem(list, value);
    if (item) {
      items.push(item);
    }
  }
  return items;
};

const CHOOSE_DEFAULT_HEIGHT = 10;
const CHOOSE_DEFAULT_CURSOR = '> ';

/**
 * Choose a single item from a list
 *
 * > gum choose --limit 1 ...
 *
 * @template [T=string]
 * @param {ListItem<T>[]|string[]} list - list to choose from
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {ListItem<T>|string} [opt.selected] - default item
 * @param {string} [opt.cursor="> "] - prefix to show on item that corresponds to the cursor position (default = "> ") ($GUM_CHOOSE_CURSOR)
 * @param {number} [opt.height=10] - height of the list (default = 10) ($GUM_CHOOSE_HEIGHT)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {ListItem<T>|undefined}
 */
export const chooseItemFromList = (list, opt) => {
  opt = opt || {};
  const items = buildItems(list);
  const cmdline = ['gum', 'choose', '--limit', '1'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.selected) {
    if (typeof opt.selected === 'object') {
      cmdline.push('--selected', opt.selected.text);
    } else {
      cmdline.push('--selected', opt.selected);
    }
  }
  if (opt.cursor) {
    cmdline.push(`--cursor=${opt.cursor}`);
  }
  if (opt.height) {
    cmdline.push('--height', opt.height.toString());
  }

  addCustomArguments(cmdline, opt.custom?.args, ['limit', 'no-limit']);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input: items.map((item) => item.text).join('\n'),
  });
  if (!p.run()) {
    return handleError(p);
  }
  return findItem(items, p.stdout);
};

const CHOOSE_DEFAULT_CURSOR_PREFIX = '○ ';
const CHOOSE_DEFAULT_SELECTED_PREFIX = '◉ ';
const CHOOSE_DEFAULT_UNSELECTED_PREFIX = '○ ';
const CHOOSE_DEFAULT_ORDERED = 'no';

/**
 * Choose multiple items from a list (press Space to select / unselect an item, Enter to confirm)
 *
 * > gum choose --no-limit ...
 *
 * @template [T=string]
 * @param {ListItem<T>[]|string[]} list - list to choose from
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {ListItem<T>|ListItem<T>[]|string|string[]} [opt.selected] - selected items
 * @param {string} [opt.cursor="> "] - prefix to show on item that corresponds to the cursor position (default = "> ") ($GUM_CHOOSE_CURSOR)
 * @param {number} [opt.height=10] - height of the list (default = 10) ($GUM_CHOOSE_HEIGHT)
 * @param {number} [opt.limit] - maximum number of items to select (no limit by default)
 * @param {boolean} [opt.ordered=false] - maintain the order of the selected items (default = false) ($GUM_CHOOSE_ORDERED)
 * @param {string} [opt.cursorPrefix="○ "] - prefix to show on the cursor item (default = "○ ") ($GUM_CHOOSE_CURSOR_PREFIX)
 * @param {string} [opt.selectedPrefix="◉ "] - prefix to show on selected items (default = "◉ ") ($GUM_CHOOSE_SELECTED_PREFIX)
 * @param {string} [opt.unselectedPrefix="○ "] - prefix to show on unselected items (default = "○ ") ($GUM_CHOOSE_UNSELECTED_PREFIX)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {ListItem<T>[]|undefined}
 */
export const chooseItemsFromList = (list, opt) => {
  opt = opt || {};
  const items = buildItems(list);
  const cmdline = ['gum', 'choose'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.selected) {
    const selectedItems = Array.isArray(opt.selected)
      ? opt.selected
      : [opt.selected];
    if (selectedItems.length) {
      const list = [];
      for (const selectedItem of selectedItems) {
        if (typeof selectedItem === 'object') {
          list.push(selectedItem.text);
        } else {
          list.push(selectedItem);
        }
      }
      cmdline.push('--selected', list.join(','));
    }
  }
  if (opt.cursor) {
    cmdline.push(`--cursor=${opt.cursor}`);
  }
  if (opt.height) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.limit) {
    cmdline.push('--limit', opt.limit.toString());
  } else {
    cmdline.push('--no-limit');
  }
  if (opt.ordered !== undefined) {
    cmdline.push(`--ordered=${opt.ordered ? 'yes' : 'no'}`);
  }
  if (opt.cursorPrefix) {
    cmdline.push(`--cursor-prefix=${opt.cursorPrefix}`);
  }
  if (opt.selectedPrefix) {
    cmdline.push(`--selected-prefix=${opt.selectedPrefix}`);
  }
  if (opt.unselectedPrefix) {
    cmdline.push(`--unselected-prefix=${opt.unselectedPrefix}`);
  }

  addCustomArguments(cmdline, opt.custom?.args, ['limit', 'no-limit']);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input: items.map((item) => item.text).join('\n'),
  });
  if (!p.run()) {
    return handleError(p);
  }
  const selectedValues = p.stdout.split('\n');
  return findItems(items, selectedValues);
};

const FILTER_DEFAULT_PROMPT = '> ';
const FILTER_DEFAULT_HEIGHT = 0;
const FILTER_DEFAULT_WIDTH = 20;
const FILTER_DEFAULT_PLACEHOLDER = 'Filter...';
const FILTER_DEFAULT_FUZZY = 'yes';
const FILTER_DEFAULT_SORT = 'yes';
const FILTER_DEFAULT_REVERSE = 'no';

/**
 * Choose a single item by filtering a list
 *
 * > gum filter --limit 1 ...
 *
 * @template [T=string]
 * @param {ListItem<T>[]|string[]} list - list to choose from
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {string} [opt.placeholder="Filter..."] - placeholder value (default = "Filter...") ($GUM_FILTER_PLACEHOLDER)
 * @param {number} [opt.width=20] - width of the list (default = 20) ($GUM_FILTER_WIDTH)
 * @param {number} [opt.height] - height of the list (no limit by default, will depend on the terminal) ($GUM_FILTER_HEIGHT)
 * @param {string} [opt.prompt="> "] - prompt to display (default = "> ") ($GUM_FILTER_PROMPT)
 * @param {string} [opt.value] - initial filter value
 * @param {boolean} [opt.fuzzy=true] - enable fuzzy search (default = true) ($GUM_FILTER_FUZZY)
 * @param {boolean} [opt.reverse=false] - display from the bottom of the screen (default = false) ($GUM_FILTER_REVERSE)
 * @param {boolean} [opt.sort=true] - sort the results (default = true) ($GUM_FILTER_SORT)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {ListItem<T>|undefined}
 */
export const filterItemFromList = (list, opt) => {
  opt = opt || {};
  const items = buildItems(list);
  const cmdline = ['gum', 'filter', '--limit', '1'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.placeholder !== undefined) {
    cmdline.push('--placeholder', opt.placeholder);
  }
  if (opt.width !== undefined) {
    cmdline.push('--width', opt.width.toString());
  }
  if (opt.height !== undefined) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.prompt !== undefined) {
    cmdline.push('--prompt', opt.prompt);
  }
  if (opt.value) {
    cmdline.push('--value', opt.value);
  }
  if (opt.fuzzy !== undefined) {
    cmdline.push(opt.fuzzy ? '--fuzzy' : '--no-fuzzy');
  }
  if (opt.sort !== undefined) {
    cmdline.push(opt.sort ? '--sort' : '--no-sort');
  }
  if (opt.reverse !== undefined) {
    cmdline.push(`--reverse=${opt.reverse ? 'yes' : 'no'}`);
  }

  addCustomArguments(cmdline, opt.custom?.args, ['limit', 'no-limit']);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input: items.map((item) => item.text).join('\n'),
  });
  if (!p.run()) {
    return handleError(p);
  }
  return findItem(items, p.stdout);
};

const FILTER_DEFAULT_INDICATOR = '•';
const FILTER_DEFAULT_SELECTED_PREFIX = ' ◉ ';
const FILTER_DEFAULT_UNSELECTED_PREFIX = ' ○ ';

/**
 * Choose multiple items by filtering a list (press Ctrl+Space to select/unselect an item, Enter to confirm)
 *
 * > gum filter --no-limit ...
 *
 * @template [T=string]
 * @param {ListItem<T>[]|string[]} list - list to choose from
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {string} [opt.placeholder="Filter..."] - placeholder value (default = "Filter...") ($GUM_FILTER_PLACEHOLDER)
 * @param {number} [opt.width=20] - width of the list (default = 20) ($GUM_FILTER_WIDTH)
 * @param {number} [opt.height] - height of the list (no limit by default, will depend on the terminal) ($GUM_FILTER_HEIGHT)
 * @param {string} [opt.prompt="> "] - prompt to display (default = "> ") ($GUM_FILTER_PROMPT)
 * @param {string} [opt.value] - initial filter value
 * @param {number} [opt.limit] - maximum number of items to select (no limit by default)
 * @param {boolean} [opt.fuzzy=true] - enable fuzzy search (default = true) ($GUM_FILTER_FUZZY)
 * @param {boolean} [opt.reverse=false] - display from the bottom of the screen (default = false) ($GUM_FILTER_REVERSE)
 * @param {boolean} [opt.sort=true] - sort the filtered items (default = true) ($GUM_FILTER_SORT)
 * @param {string} [opt.indicator="•"] - character for selection (default = "•") ($GUM_FILTER_INDICATOR)
 * @param {string} [opt.selectedPrefix=" ◉ "] - character to indicate selected items (default = " ◉ ") ($GUM_FILTER_SELECTED_PREFIX)
 * @param {string} [opt.unselectedPrefix=" ○ "] - character to indicate selected items (default = " ○ ") ($GUM_FILTER_UNSELECTED_PREFIX)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {ListItem<T>[]|undefined}
 */
export const filterItemsFromList = (list, opt) => {
  opt = opt || {};
  const items = buildItems(list);
  const cmdline = ['gum', 'filter'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.placeholder !== undefined) {
    cmdline.push('--placeholder', opt.placeholder);
  }
  if (opt.width !== undefined) {
    cmdline.push('--width', opt.width.toString());
  }
  if (opt.height !== undefined) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.prompt !== undefined) {
    cmdline.push('--prompt', opt.prompt);
  }
  if (opt.value) {
    cmdline.push('--value', opt.value);
  }
  if (opt.fuzzy !== undefined) {
    cmdline.push(opt.fuzzy ? '--fuzzy' : '--no-fuzzy');
  }
  if (opt.sort !== undefined) {
    cmdline.push(opt.sort ? '--sort' : '--no-sort');
  }
  if (opt.reverse !== undefined) {
    cmdline.push(`--reverse=${opt.reverse ? 'yes' : 'no'}`);
  }
  if (opt.limit) {
    cmdline.push('--limit', opt.limit.toString());
  } else {
    cmdline.push('--no-limit');
  }
  if (opt.indicator) {
    cmdline.push('--indicator', opt.indicator);
  }
  if (opt.selectedPrefix) {
    cmdline.push('--selected-prefix', opt.selectedPrefix);
  }
  if (opt.unselectedPrefix) {
    cmdline.push('--unselected-prefix', opt.unselectedPrefix);
  }

  addCustomArguments(cmdline, opt.custom?.args, ['limit', 'no-limit']);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input: items.map((item) => item.text).join('\n'),
  });
  if (!p.run()) {
    return handleError(p);
  }
  const selectedValues = p.stdout.split('\n');
  return findItems(items, selectedValues);
};

const STYLE_DEFAULT_BORDER = Border.NONE;
const STYLE_DEFAULT_ALIGN = Align.LEFT;
const STYLE_DEFAULT_HEIGHT = 1;
const STYLE_DEFAULT_WIDTH = 0;
const STYLE_DEFAULT_MARGIN_LEFT = 0;
const STYLE_DEFAULT_MARGIN_RIGHT = 0;
const STYLE_DEFAULT_MARGIN_TOP = 0;
const STYLE_DEFAULT_MARGIN_BOTTOM = 0;
const STYLE_DEFAULT_PADDING_LEFT = 0;
const STYLE_DEFAULT_PADDING_RIGHT = 0;
const STYLE_DEFAULT_PADDING_TOP = 0;
const STYLE_DEFAULT_PADDING_BOTTOM = 0;
const STYLE_DEFAULT_BOLD = 'no';
const STYLE_DEFAULT_ITALIC = 'no';
const STYLE_DEFAULT_UNDERLINE = 'no';
const STYLE_DEFAULT_STRIKETHROUGH = 'no';
const STYLE_DEFAULT_FAINT = 'no';

/**
 * Merge margin values
 *
 * @param {Record<string,string>} env - environment variables
 * @param {number|string} [top] - value for top margin
 * @param {number|string} [right] - value for right margin
 * @param {number|string} [bottom] - value for top margin
 * @param {number|string} [left] - value for right margin
 *
 * @return {string}
 */
const mergeMarginValues = (env, top, right, bottom, left) => {
  return `${top ?? env['MARGIN_TOP']} ${right ?? env['MARGIN_RIGHT']} ${
    bottom ?? env['MARGIN_BOTTOM']
  } ${left ?? env['MARGIN_LEFT']}`;
};

/**
 * Merge padding values
 *
 * @param {Record<string,string>} env - environment variables
 * @param {number|string} [top] - value for top padding
 * @param {number|string} [right] - value for right padding
 * @param {number|string} [bottom] - value for top padding
 * @param {number|string} [left] - value for right padding
 *
 * @return {string}
 */
const mergePaddingValues = (env, top, right, bottom, left) => {
  return `${top ?? env['PADDING_TOP']} ${right ?? env['PADDING_RIGHT']} ${
    bottom ?? env['PADDING_BOTTOM']
  } ${left ?? env['PADDING_LEFT']}`;
};

/**
 * Apply coloring, borders, spacing to text
 *
 * > gum style ...
 *
 * @param {string|string[]} text - text to style
 * @param {object} [opt] - options
 * @param {string|number} [opt.background] - background color ($BACKGROUND)
 * @param {string|number} [opt.foreground] - foreground color ($FOREGROUND)
 * @param {Border} [opt.border="none"] - border style (default = Border.NONE) ($BORDER)
 * @param {string|number} [opt.borderBackground] - border background color ($BORDER_BACKGROUND)
 * @param {string|number} [opt.borderForeground] - border foreground color ($BORDER_FOREGROUND)
 * @param {Align} [opt.align=left] - text alignment (default = Align.LEFT) ($ALIGN)
 * @param {number} [opt.height=1] - text height (default = 1) ($HEIGHT)
 * @param {number} [opt.width=0] - text width (default = 0, automatic width) ($WIDTH)
 * @param {number} [opt.marginLeft=0] - top margin (default = 0) ($MARGIN_LEFT)
 * @param {number} [opt.marginRight=0] - right margin (default = 0) ($MARGIN_RIGHT)
 * @param {number} [opt.marginTop=0] - top margin (default = 0) ($MARGIN_TOP)
 * @param {number} [opt.marginBottom=0] - bottom margin (default = 0) ($MARGIN_BOTTOM)
 * @param {number} [opt.paddingLeft=0] - left padding (default = 0) ($PADDING_LEFT)
 * @param {number} [opt.paddingRight=0] - right padding (default = 0) ($PADDING_RIGHT)
 * @param {number} [opt.paddingTop=0] - top padding (default = 0) ($PADDING_TOP)
 * @param {number} [opt.paddingBottom=0] - bottom padding (default = 0) ($PADDING_BOTTOM)
 * @param {boolean} [opt.bold=false] - bold text (default = false) ($BOLD)
 * @param {boolean} [opt.italic=false] - italicize text (default = false) ($ITALIC)
 * @param {boolean} [opt.strikethrough=false] - strikethrough text (default = false) ($STRIKETHROUGH)
 * @param {boolean} [opt.underline=false] - underline text (default = false) ($UNDERLINE)
 * @param {boolean} [opt.faint=false] - faint text (default = false) ($FAINT)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string}
 */
export const style = (text, opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'style'];
  if (Array.isArray(text)) {
    cmdline.push(...text);
  } else {
    cmdline.push(text);
  }
  if (opt.background) {
    cmdline.push('--background', opt.background.toString());
  }
  if (opt.foreground) {
    cmdline.push('--foreground', opt.foreground.toString());
  }
  if (opt.border) {
    cmdline.push('--border', opt.border);
  }
  if (opt.borderBackground) {
    cmdline.push('--border-background', opt.borderBackground.toString());
  }
  if (opt.borderForeground) {
    cmdline.push('--border-foreground', opt.borderForeground.toString());
  }
  if (opt.align) {
    cmdline.push('--align', opt.align);
  }
  if (opt.height !== undefined) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.width !== undefined) {
    cmdline.push('--width', opt.width.toString());
  }

  /*
    We retrieve environment first because merging margin/padding
    values relies on those environment variables as fallback
   */
  const env = getEnv(opt.custom?.env, ['MARGIN', 'PADDING']);

  cmdline.push(
    '--margin',
    mergeMarginValues(
      env,
      opt.marginTop,
      opt.marginRight,
      opt.marginBottom,
      opt.marginLeft
    )
  );
  cmdline.push(
    '--padding',
    mergePaddingValues(
      env,
      opt.paddingTop,
      opt.paddingRight,
      opt.paddingBottom,
      opt.paddingLeft
    )
  );
  if (opt.bold !== undefined) {
    cmdline.push(`--bold=${opt.bold ? 'yes' : 'no'}`);
  }
  if (opt.italic !== undefined) {
    cmdline.push(`--italic=${opt.bold ? 'yes' : 'no'}`);
  }
  if (opt.strikethrough !== undefined) {
    cmdline.push(`--strikethrough=${opt.bold ? 'yes' : 'no'}`);
  }
  if (opt.underline !== undefined) {
    cmdline.push(`--underline=${opt.bold ? 'yes' : 'no'}`);
  }
  if (opt.faint !== undefined) {
    cmdline.push(`--faint=${opt.bold ? 'yes' : 'no'}`);
  }

  addCustomArguments(cmdline, opt.custom?.args, ['margin', 'padding']);

  delete env['MARGIN_LEFT'];
  delete env['MARGIN_RIGHT'];
  delete env['MARGIN_TOP'];
  delete env['MARGIN_BOTTOM'];
  delete env['PADDING_LEFT'];
  delete env['PADDING_RIGHT'];
  delete env['PADDING_TOP'];
  delete env['PADDING_BOTTOM'];

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return '';
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    trim: false,
  });
  if (!p.run()) {
    throw new Error(p.stderr);
  }

  const output = p.stdout;
  if (output.endsWith('\n')) {
    return output.slice(0, -1);
  }
  return output;
};

/**
 * Character used to separate fields in table rows
 */
const FIELD_SEPARATOR = ',';

/**
 * @template [T=string[]]
 * @typedef {Object} TableRow
 * @property {string[]} fields
 * @property {T} value
 */

/**
 * @template [T=string[]]
 * @typedef {TableRow<T> & { key: string }} ExtendedTableRow
 */

/**
 * @param {string[]} fields
 *
 * @returns {string}
 */
const serializeFields = (fields) => {
  return fields.join(FIELD_SEPARATOR);
};

/**
 * @template [T=string[]]
 * @param {TableRow<T>[]|string[][]} rows
 *
 * @returns {ExtendedTableRow<T>[]}
 */
const buildTableRows = (rows) => {
  /** @type {ExtendedTableRow<T>[]} */
  const extendedRows = [];
  for (const row of rows) {
    if (Array.isArray(row)) {
      /** @type {any} */
      const extendedRow = {
        fields: row,
        value: row,
        key: serializeFields(row),
      };
      extendedRows.push(extendedRow);
    } else {
      /** @type {any} */
      let r = row;
      extendedRows.push({
        fields: r.fields,
        value: r.value,
        key: serializeFields(r.fields),
      });
    }
  }
  return extendedRows;
};

/**
 * @template [T=string[]]
 * @param {ExtendedTableRow<T>[]} rows
 * @param {string} key
 *
 * @returns {TableRow<T>|undefined}
 */
const findTableRow = (rows, key) => {
  for (const row of rows) {
    if (row.key === key) {
      return { fields: row.fields, value: row.value };
    }
  }
};

const TABLE_DEFAULT_BORDER = Border.ROUNDED;
const TABLE_DEFAULT_HEIGHT = 20;

/**
 * Render a list of rows as a table
 *
 * > gum table --print --separator ',' ...
 *
 * @template [T=string[]]
 * @param {string[]} columns - column names
 * @param {TableRow<T>[]|string[][]} rows
 * @param {object} [opt] - options
 * @param {Border} [opt.border="rounded"] - border style (default = Border.ROUNDED)
 * @param {number[]} [opt.widths] - column widths
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string}
 */
export const renderTable = (columns, rows, opt) => {
  opt = opt || {};
  const extendedRows = buildTableRows(rows);
  const cmdline = [
    'gum',
    'table',
    '--print',
    '--separator',
    FIELD_SEPARATOR,
    '--columns',
    columns.join(FIELD_SEPARATOR),
  ];
  if (opt.border) {
    cmdline.push('--border', opt.border);
  } else {
    cmdline.push('--border', TABLE_DEFAULT_BORDER);
  }
  if (opt.widths?.length) {
    cmdline.push('--widths', opt.widths.join(','));
  }

  addCustomArguments(cmdline, opt.custom?.args, [
    'separator',
    's',
    'file',
    'f',
  ]);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return '';
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input: extendedRows.map((row) => row.key).join('\n'),
  });
  if (!p.run()) {
    throw new Error(p.stderr);
  }
  return p.stdout;
};

/**
 * Choose a row from a table
 *
 * > gum table --separator ',' ...
 *
 * @template [T=string[]]
 * @param {string[]} columns - column names
 * @param {TableRow<T>[]|string[][]} rows
 * @param {object} [opt] - options
 * @param {number[]} [opt.widths] - column widths
 * @param {number} [opt.height=20] - table height (default = 20)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {TableRow<T>|undefined}
 */
export const chooseRowFromTable = (columns, rows, opt) => {
  opt = opt || {};
  const extendedRows = buildTableRows(rows);
  const widths = columns.map((column) => column.length);
  // build input and update column widths
  const input = extendedRows
    .map((row) => {
      row.fields.forEach((field, index) => {
        if (field?.length > widths[index]) {
          widths[index] = field.length;
        }
      });
      return row.key;
    })
    .join('\n');

  const cmdline = [
    'gum',
    'table',
    '--separator',
    FIELD_SEPARATOR,
    '--columns',
    columns.join(FIELD_SEPARATOR),
  ];
  cmdline.push('--height', (opt.height || TABLE_DEFAULT_HEIGHT).toString());
  if (opt.widths?.length) {
    cmdline.push('--widths', opt.widths.join(','));
  } else {
    cmdline.push('--widths', widths.join(','));
  }

  addCustomArguments(cmdline, opt.custom?.args, [
    'separator',
    's',
    'print',
    'p',
    'file',
    'f',
  ]);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }
  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    input,
  });
  if (!p.run()) {
    return handleError(p);
  }
  return findTableRow(extendedRows, p.stdout);
};

const CONFIRM_DEFAULT_PROMPT = 'Are you sure?';

/**
 * @readonly
 * @enum {string}
 */
export const ConfirmAnswer = {
  YES: 'yes',
  NO: 'no',
};

/**
 * Ask user to confirm an action
 *
 * > gum confirm ...
 *
 * @param {object} [opt] - options
 * @param {string} [opt.prompt="Are you sure?"] - prompt to display (default = "Are you sure?"")
 * @param {string} [opt.affirmative="Yes"] - affirmative answer (default = "Yes")
 * @param {string} [opt.negative="No"] - negative answer (default = "No")
 * @param {ConfirmAnswer} [opt.default="yes"] - default confirmation action (default = ConfirmAnswer.YES)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {boolean|undefined}
 */
export const confirm = (opt) => {
  opt = opt || {};
  const cmdline = [
    'gum',
    'confirm',
    `--default=${opt.default !== 'no' ? 'yes' : 'no'}`,
    '--affirmative',
    opt.affirmative || 'Yes',
    '--negative',
    opt.negative || 'No',
    opt.prompt || CONFIRM_DEFAULT_PROMPT,
  ];

  addCustomArguments(cmdline, opt.custom?.args, [
    'default',
    'affirmative',
    'negative',
  ]);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
  });
  if (!p.run()) {
    if (p.exitCode === 130) {
      return undefined;
    }
    if (p.exitCode === 1) {
      return false;
    }
    throw new Error(p.stderr);
  }
  return true;
};

const FILE_DEFAULT_HEIGHT = 0;
const FILE_DEFAULT_CURSOR = '>';

/**
 * Pick a file from a folder
 *
 * > gum file ...
 *
 * @param {object} [opt] - options
 * @param {string} [opt.path] - the path to the folder to begin traversing (default = current directory)
 * @param {boolean} [opt.all=false] - if true, show hidden and 'dot' files
 * @param {string} [opt.cursor=">"] - the cursor character (default = ">") ($GUM_FILE_CURSOR)
 * @param {number} [opt.height] - maximum number of files to display (no limit by default, will depend on the terminal) ($GUM_FILE_HEIGHT)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string|undefined}
 */
export const chooseFile = (opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'file'];
  if (opt.cursor !== undefined) {
    cmdline.push(`--cursor=${opt.cursor}`);
  }
  if (opt.all) {
    cmdline.push('--all');
  }
  if (opt.height) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.path) {
    cmdline.push(opt.path);
  }

  addCustomArguments(cmdline, opt.custom?.args);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
  });
  if (!p.run()) {
    if (p.exitCode === 130) {
      return undefined;
    }
    throw new Error(p.stderr);
  }
  return p.stdout;
};

/**
 * @readonly
 * @enum {string}
 */
export const Spinner = {
  LINE: 'line',
  DOT: 'dot',
  MINI_DOT: 'minidot',
  JUMP: 'jump',
  PULSE: 'pulse',
  POINTS: 'points',
  GLOBE: 'globe',
  MOON: 'moon',
  MONKEY: 'monkey',
  METER: 'meter',
  HAMBURGER: 'hamburger',
};

/**
 * @readonly
 * @enum {string}
 */
export const SpinAlign = {
  LEFT: 'left',
  RIGHT: 'right',
};

const SPIN_DEFAULT_SPINNER = Spinner.DOT;
const SPIN_DEFAULT_TITLE = 'Loading...';
const SPIN_DEFAULT_ALIGN = SpinAlign.LEFT;

/**
 * Display a spinner while a promise is resolving
 *
 * > gum spin ...
 *
 * @param {Promise} [promise] - promise to wait for
 * @param {object} [opt] - options
 * @param {string} [opt.title="Loading..."] - title value (default = "Loading...") ($GUM_SPIN_TITLE)
 * @param {string} [opt.spinner="dot"] - spinner value (default = Spinner.DOT) ($GUM_SPIN_SPINNER)
 * @param {string} [opt.align="left"] - alignment of spinner with regard to the title (default = Align.LEFT) ($GUM_SPIN_ALIGN)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {Promise<boolean>} whether or not spinner was cancelled (ie: using Ctrl+C)
 */
export const spin = async (promise, opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'spin'];
  if (opt.title !== undefined) {
    cmdline.push('--title', opt.title);
  }
  if (opt.spinner) {
    cmdline.push('--spinner', opt.spinner);
  }
  if (opt.align) {
    cmdline.push('--align', opt.align);
  }

  addCustomArguments(cmdline, opt.custom?.args, ['show-output']);
  const env = getEnv(opt.custom?.env);

  cmdline.push('--', 'tail', '-f');

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return true;
  }

  /** @type {Promise<boolean>} */
  const spinnerPromise = new Promise(async (resolve) => {
    // start spinner
    const spinProcess = new Process(cmdline, {
      env,
      replaceEnv: false,
      passStderr: true,
    });
    spinProcess.setEventListener(
      'exit',
      (/** @type {ProcessState} */ state) => {
        if (state.exitCode === 130) {
          resolve(true);
        }
      }
    );
    spinProcess.run();
    // wait for promise to resolve and stop spinner when it's done
    await promise;
    spinProcess.kill();
    await spinProcess.wait();
    resolve(false);
  });
  return spinnerPromise;
};

const INPUT_DEFAULT_CHAR_LIMIT = 400;
const INPUT_DEFAULT_WIDTH = 40;
const INPUT_DEFAULT_PLACEHOLDER = 'Type something...';
const INPUT_DEFAULT_PROMPT = '> ';
const INPUT_DEFAULT_CURSOR_MODE = CursorMode.BLINK;

/**
 * Prompt for some input
 *
 * > gum input ...
 *
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {string} [opt.cursorMode="blink"] - cursor mode (default = CursorMode.BLINK) ($GUM_INPUT_CURSOR_MODE)
 * @param {string} [opt.placeholder="Type something..."] - placeholder value (default = "Type something...") ($GUM_INPUT_PLACEHOLDER)
 * @param {string} [opt.value] - initial value
 * @param {string} [opt.prompt="> "] - prompt to display (default = "> ") ($GUM_INPUT_PROMPT)
 * @param {boolean} [opt.password=false] - mask input characters (default = false)
 * @param {number} [opt.charLimit=400] - maximum value length (default = 400, 0 for no limit)
 * @param {number} [opt.width=40] - input width (default = 40, 0 for terminal width) ($GUM_INPUT_WIDTH)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string|undefined}
 */
export const input = (opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'input'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.placeholder) {
    cmdline.push('--placeholder', opt.placeholder);
  }
  if (opt.prompt !== undefined) {
    cmdline.push('--prompt', opt.prompt);
  }
  if (opt.value) {
    cmdline.push('--value', opt.value);
  }
  if (opt.password) {
    cmdline.push('--password');
  }
  cmdline.push(
    '--char-limit',
    (opt.charLimit ?? INPUT_DEFAULT_CHAR_LIMIT).toString()
  );
  if (opt.width !== undefined) {
    cmdline.push('--width', opt.width.toString());
  }
  if (opt.cursorMode) {
    cmdline.push('--cursor.mode', opt.cursorMode);
  }

  addCustomArguments(cmdline, opt.custom?.args);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
  });
  if (!p.run()) {
    return handleError(p);
  }
  return p.stdout;
};

const WRITE_DEFAULT_WIDTH = 50;
const WRITE_DEFAULT_HEIGHT = 10;
const WRITE_DEFAULT_PLACEHOLDER = 'Write something...';
const WRITE_DEFAULT_PROMPT = '┃ ';
const WRITE_DEFAULT_CURSOR_MODE = CursorMode.BLINK;
const WRITE_DEFAULT_CHAR_LIMIT = 400;
const WRITE_DEFAULT_SHOW_LINE_NUMBERS = 'no';

/**
 * Prompt for long-form text (press Ctrl+D or Esc to confirm)
 *
 * > gum write ...
 *
 * @param {object} [opt] - options
 * @param {string} [opt.header] - header value
 * @param {string} [opt.cursorMode="blink"] - cursor mode (default = CursorMode.BLINK) ($GUM_WRITE_CURSOR_MODE)
 * @param {string} [opt.placeholder="Write something..."] - placeholder value (default = "Write something...") ($GUM_WRITE_PLACEHOLDER)
 * @param {string} [opt.value] - initial value
 * @param {string} [opt.prompt="┃ "] - prompt to display (default = "┃ ") ($GUM_WRITE_PROMPT)
 * @param {number} [opt.charLimit=400] - maximum value length (default = 400, 0 for no limit)
 * @param {number} [opt.width=50] - input width (default = 50, 0 for no limit) ($GUM_WRITE_WIDTH)
 * @param {number} [opt.height=10] - input height (default = 10) ($GUM_WRITE_HEIGHT)
 * @param {boolean} [opt.showLineNumbers=false] - show line numbers (default = false) ($GUM_WRITE_SHOW_LINE_NUMBERS)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string|undefined}
 */
export const write = (opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'write'];
  if (opt.header) {
    cmdline.push('--header', opt.header);
  }
  if (opt.placeholder) {
    cmdline.push('--placeholder', opt.placeholder);
  }
  if (opt.prompt !== undefined) {
    cmdline.push('--prompt', opt.prompt);
  }
  if (opt.value) {
    cmdline.push('--value', opt.value);
  }
  cmdline.push(
    '--char-limit',
    (opt.charLimit ?? WRITE_DEFAULT_CHAR_LIMIT).toString()
  );
  if (opt.width !== undefined) {
    cmdline.push('--width', opt.width.toString());
  }
  if (opt.height !== undefined) {
    cmdline.push('--height', opt.height.toString());
  }
  if (opt.cursorMode) {
    cmdline.push('--cursor.mode', opt.cursorMode);
  }
  if (opt.showLineNumbers !== undefined) {
    cmdline.push(`--show-line-numbers=${opt.showLineNumbers ? 'yes' : 'no'}`);
  }

  addCustomArguments(cmdline, opt.custom?.args);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
  });
  if (!p.run()) {
    return handleError(p);
  }
  return p.stdout;
};

/**
 * @readonly
 * @enum {string}
 */
export const FormatType = {
  MARKDOWN: 'markdown',
  CODE: 'code',
  EMOJI: 'emoji',
  TEMPLATE: 'template',
};

/**
 * @readonly
 * @enum {string}
 */
export const FormatTheme = {
  PINK: 'pink',
  LIGHT: 'light',
  DARK: 'dark',
  DRACULA: 'dracula',
};

const FORMAT_DEFAULT_TYPE = FormatType.MARKDOWN;
const FORMAT_DEFAULT_THEME = FormatTheme.PINK;

/**
 * Format a string using a template
 *
 * > gum format ...
 *
 * @param {string} text - text to format
 * @param {object} [opt] - options
 * @param {FormatType} [opt.type="markdown"] - format type (default = FormatType.MARKDOWN) ($GUM_FORMAT_TYPE)
 * @param {string} [opt.language] - programming language to parse when using FormatType.Code ($GUM_FORMAT_LANGUAGE)
 * @param {FormatTheme} [opt.theme="pink"] - theme to use for markdown formatting (default = FormatTheme.PINK) ($GUM_FORMAT_THEME)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string}
 */
export const format = (text, opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'format', text];
  if (opt.type) {
    cmdline.push('--type', opt.type);
  }
  if (opt.theme) {
    cmdline.push('--theme', opt.theme);
  }
  if (opt.language) {
    cmdline.push('--language', opt.language);
  }

  addCustomArguments(cmdline, opt.custom?.args);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return '';
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    trim: false,
  });
  if (!p.run()) {
    throw new Error(p.stderr);
  }

  const output = p.stdout;
  if (output.endsWith('\n')) {
    return output.slice(0, -1);
  }
  return output;
};

/**
 * @readonly
 * @enum {string}
 */
export const JoinDirection = {
  VERTICAL: 'vertical',
  HORIZONTAL: 'horizontal',
};

export const JOIN_DEFAULT_DIRECTION = JoinDirection.HORIZONTAL;
export const JOIN_DEFAULT_ALIGN = Align.LEFT;

/**
 * Join text vertically or horizontally
 *
 * > gum join ...
 *
 * @param {string[]} text - text to join
 * @param {object} [opt] - options
 * @param {Align} [opt.align=left] - text alignment (default = Align.LEFT)
 * @param {JoinDirection} [opt.direction="horizontal"] - join direction (default = JoinDirection.HORIZONTAL)
 * @param {CustomOptions} [opt.custom]
 *
 * @returns {string}
 */
export const join = (text, opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'join', ...text];
  cmdline.push('--align', opt.align ?? JOIN_DEFAULT_ALIGN);
  const direction = opt.direction ?? JOIN_DEFAULT_DIRECTION;
  cmdline.push(
    direction === JoinDirection.VERTICAL ? '--vertical' : '--horizontal'
  );

  addCustomArguments(cmdline, opt.custom?.args, ['vertical', 'horizontal']);
  const env = getEnv(opt.custom?.env);

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return '';
  }

  const p = new ProcessSync(cmdline, {
    env,
    replaceEnv: false,
    trim: false,
  });
  if (!p.run()) {
    throw new Error(p.stderr);
  }

  const output = p.stdout;
  if (output.endsWith('\n')) {
    return output.slice(0, -1);
  }
  return output;
};

/**
 * Scroll through content
 *
 * > gum pager ...
 *
 * @param {string} content - content to scroll
 * @param {object} [opt] - options
 * @param {boolean} [opt.showLineNumbers=true] - show line numbers (default = true)
 * @param {boolean} [opt.softWrap=false] - soft wrap lines (default = false)
 * @param {CustomOptions} [opt.custom]
 */
export const pager = (content, opt) => {
  opt = opt || {};
  const cmdline = ['gum', 'pager', content];
  cmdline.push(
    `--show-line-numbers=${opt.showLineNumbers !== false ? 'yes' : 'no'}`
  );
  cmdline.push(`--soft-wrap=${opt.softWrap ? 'yes' : 'no'}`);

  addCustomArguments(cmdline, opt.custom?.args);
  const env = {
    ...std.getenviron(),
    ...getEnv(opt.custom?.env),
  };

  if (opt.custom?.dryRunCb) {
    opt.custom.dryRunCb(cmdline, env);
    return;
  }

  os.exec(cmdline, {
    env,
  });
};

/**
 * Clear the terminal :)
 */
export const clear = () => {
  os.exec(['clear']);
};

/*
  Default environment variables
 */
// choose
defaultEnvironment['GUM_CHOOSE_CURSOR'] = CHOOSE_DEFAULT_CURSOR;
defaultEnvironment['GUM_CHOOSE_HEIGHT'] = CHOOSE_DEFAULT_HEIGHT.toString();
defaultEnvironment['GUM_CHOOSE_CURSOR_PREFIX'] = CHOOSE_DEFAULT_CURSOR_PREFIX;
defaultEnvironment['GUM_CHOOSE_SELECTED_PREFIX'] =
  CHOOSE_DEFAULT_SELECTED_PREFIX;
defaultEnvironment['GUM_CHOOSE_UNSELECTED_PREFIX'] =
  CHOOSE_DEFAULT_UNSELECTED_PREFIX;
defaultEnvironment['GUM_CHOOSE_ORDERED'] = CHOOSE_DEFAULT_ORDERED;

// filter
defaultEnvironment['GUM_FILTER_HEIGHT'] = FILTER_DEFAULT_HEIGHT.toString();
defaultEnvironment['GUM_FILTER_WIDTH'] = FILTER_DEFAULT_WIDTH.toString();
defaultEnvironment['GUM_FILTER_PLACEHOLDER'] = FILTER_DEFAULT_PLACEHOLDER;
defaultEnvironment['GUM_FILTER_PROMPT'] = FILTER_DEFAULT_PROMPT;
defaultEnvironment['GUM_FILTER_INDICATOR'] = FILTER_DEFAULT_INDICATOR;
defaultEnvironment['GUM_FILTER_SELECTED_PREFIX'] =
  FILTER_DEFAULT_SELECTED_PREFIX;
defaultEnvironment['GUM_FILTER_UNSELECTED_PREFIX'] =
  FILTER_DEFAULT_UNSELECTED_PREFIX;
defaultEnvironment['GUM_FILTER_FUZZY'] = FILTER_DEFAULT_FUZZY;
defaultEnvironment['GUM_FILTER_SORT'] = FILTER_DEFAULT_SORT;
defaultEnvironment['GUM_FILTER_REVERSE'] = FILTER_DEFAULT_REVERSE;

// file
defaultEnvironment['GUM_FILE_CURSOR'] = FILE_DEFAULT_CURSOR;
defaultEnvironment['GUM_FILE_HEIGHT'] = FILE_DEFAULT_HEIGHT.toString();

// spin
defaultEnvironment['GUM_SPIN_TITLE'] = SPIN_DEFAULT_TITLE;
defaultEnvironment['GUM_SPIN_SPINNER'] = SPIN_DEFAULT_SPINNER;
defaultEnvironment['GUM_SPIN_ALIGN'] = SPIN_DEFAULT_ALIGN;

// input
defaultEnvironment['GUM_INPUT_CURSOR_MODE'] = INPUT_DEFAULT_CURSOR_MODE;
defaultEnvironment['GUM_INPUT_PLACEHOLDER'] = INPUT_DEFAULT_PLACEHOLDER;
defaultEnvironment['GUM_INPUT_PROMPT'] = INPUT_DEFAULT_PROMPT;
defaultEnvironment['GUM_INPUT_WIDTH'] = INPUT_DEFAULT_WIDTH.toString();

// write
defaultEnvironment['GUM_WRITE_CURSOR_MODE'] = WRITE_DEFAULT_CURSOR_MODE;
defaultEnvironment['GUM_WRITE_PLACEHOLDER'] = WRITE_DEFAULT_PLACEHOLDER;
defaultEnvironment['GUM_WRITE_PROMPT'] = WRITE_DEFAULT_PROMPT;
defaultEnvironment['GUM_WRITE_WIDTH'] = WRITE_DEFAULT_WIDTH.toString();
defaultEnvironment['GUM_WRITE_HEIGHT'] = WRITE_DEFAULT_HEIGHT.toString();
defaultEnvironment['GUM_WRITE_SHOW_LINE_NUMBERS'] =
  WRITE_DEFAULT_SHOW_LINE_NUMBERS;

// style
defaultEnvironment['BORDER'] = STYLE_DEFAULT_BORDER;
defaultEnvironment['ALIGN'] = STYLE_DEFAULT_ALIGN;
defaultEnvironment['HEIGHT'] = STYLE_DEFAULT_HEIGHT.toString();
defaultEnvironment['WIDTH'] = STYLE_DEFAULT_WIDTH.toString();
defaultEnvironment['MARGIN_LEFT'] = STYLE_DEFAULT_MARGIN_LEFT.toString();
defaultEnvironment['MARGIN_RIGHT'] = STYLE_DEFAULT_MARGIN_RIGHT.toString();
defaultEnvironment['MARGIN_TOP'] = STYLE_DEFAULT_MARGIN_TOP.toString();
defaultEnvironment['MARGIN_BOTTOM'] = STYLE_DEFAULT_MARGIN_BOTTOM.toString();
defaultEnvironment['PADDING_LEFT'] = STYLE_DEFAULT_PADDING_LEFT.toString();
defaultEnvironment['PADDING_RIGHT'] = STYLE_DEFAULT_PADDING_RIGHT.toString();
defaultEnvironment['PADDING_TOP'] = STYLE_DEFAULT_PADDING_TOP.toString();
defaultEnvironment['PADDING_BOTTOM'] = STYLE_DEFAULT_PADDING_BOTTOM.toString();
defaultEnvironment['BOLD'] = STYLE_DEFAULT_BOLD;
defaultEnvironment['ITALIC'] = STYLE_DEFAULT_ITALIC;
defaultEnvironment['STRIKETHROUGH'] = STYLE_DEFAULT_STRIKETHROUGH;
defaultEnvironment['UNDERLINE'] = STYLE_DEFAULT_UNDERLINE;
defaultEnvironment['FAINT'] = STYLE_DEFAULT_FAINT;

// format
defaultEnvironment['GUM_FORMAT_TYPE'] = FORMAT_DEFAULT_TYPE;
defaultEnvironment['GUM_FORMAT_THEME'] = FORMAT_DEFAULT_THEME;
