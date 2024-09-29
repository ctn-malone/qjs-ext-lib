/** @format */
// @ts-check

import * as gum from '../ext/gum.js';

/**
 * @constant
 * @enum {number}
 */
export const Color = {
  TEXT_COLOR_DEFAULT: 253,
  TEXT_COLOR_HIGHLIGHT: 212,
  TEXT_COLOR_ERROR: 3,
  TEXT_COLOR_ABORT: 3,
};

/**
 * Format a step
 *
 * @param {string} message
 *
 * @returns {string}
 */
export const formatStepHeader = (message) => {
  return gum.style(`${message}`, {
    foreground: Color.TEXT_COLOR_DEFAULT,
  });
};

/**
 * @param {string} emoji
 *
 * @returns  {string}
 */
const formatEmoji = (emoji) => {
  return gum.format(emoji, {
    type: gum.FormatType.EMOJI,
  });
};

/**
 * @returns {string}
 */
export const formatStepSuccessEmoji = () => {
  return formatEmoji(':white_check_mark:');
};

/**
 * @returns {string}
 */
export const formatStepFailureEmoji = () => {
  return formatEmoji(':x:');
};

/**
 * @param {string} message
 *
 * @returns {string}
 */
export const formatStepError = (message) => {
  return gum.style(`${message}`, {
    foreground: Color.TEXT_COLOR_ERROR,
  });
};

export const formatAbortMessage = () => {
  const message = gum.style("That's all right, maybe another time", {
    foreground: Color.TEXT_COLOR_ABORT,
  });
  const emoji = gum.format(':wink:', {
    type: gum.FormatType.EMOJI,
  });
  return `${message} ${emoji}`;
};

/**
 * @param {string} text
 * @param {boolean} [bold=false]
 *
 * @returns {string}
 */
export const highlight = (text, bold = false) => {
  return gum.style(text, {
    foreground: Color.TEXT_COLOR_HIGHLIGHT,
    bold,
  });
};

/**
 * @param {string} text
 *
 * @returns {string}
 */
export const bold = (text) => {
  return gum.style(text, {
    bold: true,
  });
};
