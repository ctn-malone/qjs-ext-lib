/** @format */
// @ts-check

import * as std from '../ext/std.js';
import { writeFile } from './utils.js';

export const CONFIG_FILE_NAME = 'qel.config.json';

/**
 * @typedef {Object} Script
 * @property {string} name
 * @property {string} file
 * @property {boolean} [default=false]
 * @property {string[]} [runtimeDeps]
 */

/**
 * @typedef {Object} Config
 * @property {number} configVersion
 * @property {string} packageName
 * @property {Script[]} scripts
 * @property {Object} options
 * @property {string[]} runtimeDeps
 */

/**
 * @param {string} configPath
 * @param {string} packageName
 */
export const createConfig = (configPath, packageName) => {
  /** @type {Config} */
  const config = {
    configVersion: 1,
    packageName: packageName,
    options: {
      compress: false,
    },
    scripts: [],
    runtimeDeps: [],
  };

  writeFile(configPath, JSON.stringify(config, null, 2));
};

/**
 * @param {string} dirPath
 *
 * @returns {string}
 */
export const getConfigPath = (dirPath) => {
  return `${dirPath}/${CONFIG_FILE_NAME}`;
};

/**
 * @param {string} configPath
 *
 * @returns {Config} config object
 */
export const loadConfig = (configPath) => {
  /** @type {Object | undefined} */
  let errObj = undefined;

  const configFile = std.open(configPath, 'r', errObj);
  if (errObj !== undefined) {
    throw new Error(
      `Could not open '${configPath}' for reading/writing (${std.strerror(
        errObj.errno
      )})`
    );
  }

  /** @type {Config} */
  let config;
  try {
    config = JSON.parse(/** @type {std.StdFile} */ (configFile).readAsString());
  } catch (e) {
    throw new Error(`Invalid config '${configPath}' (invalid json)`);
  }
  if (!config.hasOwnProperty('scripts') || !Array.isArray(config.scripts)) {
    throw new Error(
      `Invalid config '${configPath}' (missing or invalid 'scripts' property)`
    );
  }
  return config;
};

/**
 * @param {Config} config
 * @param {string} configPath
 */
export const saveConfig = (config, configPath) => {
  writeFile(configPath, JSON.stringify(config, null, 2));
};

/**
 * @param {Config} config
 * @param {string} scriptName
 * @param {Object} [options]
 * @param {string[]} [options.runtimeDeps]
 *
 * @returns {Script}
 */
export const addScript = (config, scriptName, options) => {
  const { runtimeDeps } = options ?? {};

  /** @type {Script} */
  const newScript = { name: scriptName, file: `${scriptName}.js` };
  // first script becomes the default one
  if (!config.scripts.length) {
    newScript.default = true;
  }
  newScript.runtimeDeps = [...(runtimeDeps ?? [])];
  config.scripts.push(newScript);
  return newScript;
};

/**
 * @param {Config} config
 * @param {string} scriptName
 *
 * @returns {Script|undefined}
 */
export const getScript = (config, scriptName) => {
  return config.scripts.find((item) => {
    return item.name === scriptName;
  });
};
