/** @format */
// @ts-check

// @ts-ignore
import * as std from 'std';
// @ts-ignore
import * as os from 'os';

import * as git from './git.js';
import * as style from './style.js';
import * as flake from './flake.js';
import * as config from './config.js';
import * as gum from '../ext/gum.js';
import { abort, checkFile, writeFile, getRelativePath } from './utils.js';

const SRC_DIR_NAME = 'src';

gum.updateDefaultEnv({
  GUM_CHOOSE_HEADER_FOREGROUND: style.Color.TEXT_COLOR_DEFAULT,
  GUM_INPUT_HEADER_FOREGROUND: style.Color.TEXT_COLOR_DEFAULT,
  GUM_CONFIRM_PROMPT_FOREGROUND: style.Color.TEXT_COLOR_DEFAULT,
});

/**
 * @param {string} path
 *
 * @returns {string} repository root
 */
export const ensureGitRepo = (path) => {
  if (git.isRepo(path)) {
    return git.getRoot(path);
  }
  const shouldInitializeRepo = gum.confirm({
    prompt:
      'Selected directory is not a git repository. Do you want to initialize it ?',
  });
  if (!shouldInitializeRepo) {
    std.err.puts(`${style.formatAbortMessage()}\n`);
    return abort(1);
  }
  std.err.puts(style.formatStepHeader(`Initializing git repository... `));
  std.err.flush();
  try {
    git.initRepo(path);
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  return git.getRoot(path);
};

/**
 * @returns {string} package name
 */
export const askPackageName = () => {
  /** @type {string | undefined} */
  let packageName;
  while (true) {
    packageName = gum.input({
      header: '\nWhat is the name of your package ? ',
    });
    if (packageName || packageName === undefined) {
      break;
    }
  }
  if (packageName === undefined) {
    std.err.puts(`${style.formatAbortMessage()}\n`);
    return abort(1);
  }
  return packageName.replace(' ', '-');
};

/**
 * @param {string} packageName
 *
 * @returns {string} flake description
 */
export const askFlakeDescription = (packageName) => {
  /** @type {string | undefined} */
  let description;
  while (true) {
    description = gum.input({
      header: '\nWhat is the description of your flake ? ',
      value: packageName,
    });
    if (packageName || packageName === undefined) {
      break;
    }
  }
  if (description === undefined) {
    std.err.puts(`${style.formatAbortMessage()}\n`);
    return abort(1);
  }
  return description;
};

/**
 * @returns {string} script name
 */
export const askScriptName = () => {
  /** @type {string | undefined} */
  let scriptName;
  while (true) {
    scriptName = gum.input({
      header: '\nWhat is the name of the new script ? ',
    });
    if (scriptName || scriptName === undefined) {
      break;
    }
  }
  if (scriptName === undefined) {
    std.err.puts(`${style.formatAbortMessage()}\n`);
    return abort(1);
  }
  return scriptName;
};

/**
 * @returns {string[]}
 */
export const chooseLibModules = () => {
  const items = [
    { text: 'Parse command-line arguments', value: 'arg' },
    { text: 'Perform HTTP requests', value: 'curl' },
    { text: 'Write glamorous shell scripts', value: 'gum' },
  ];
  const list = gum.chooseItemsFromList(items, {
    header:
      '\nWhich library modules do you need (use Space to select/unselect, Enter to confirm) ?',
    selected: items.filter((item) => ['arg', 'curl'].includes(item.value)),
  });
  if (list === undefined) {
    std.err.puts(`${style.formatAbortMessage()}\n`);
    return abort(1);
  }
  return list.map((item) => item.value);
};

/**
 * @param {string} repoRoot
 * @param {string} templatesRootDir - path to the root directory containing templates in the nix store
 *
 * @returns {string} config path
 */
export const ensureConfig = (repoRoot, templatesRootDir) => {
  const configPath = config.getConfigPath(repoRoot);
  const configRelativePath = getRelativePath(configPath, repoRoot);
  if (checkFile(configPath)) {
    return configPath;
  }
  const packageName = askPackageName();
  ensureMainFlake(repoRoot, templatesRootDir, packageName);
  ensureQelFlake(repoRoot, templatesRootDir);
  // create config
  std.err.puts(
    style.formatStepHeader(
      `Creating ${style.highlight(configRelativePath)}... `
    )
  );
  std.err.flush();
  try {
    config.createConfig(configPath, packageName);
    git.addEntries(repoRoot, [configPath]);
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  return configPath;
};

/**
 * @param {string} repoRoot
 * @param {string} templatesRootDir - path to the root directory containing templates in the nix store
 * @param {string} packageName
 *
 * @returns {string} main flake path
 */
export const ensureMainFlake = (repoRoot, templatesRootDir, packageName) => {
  const flakePath = flake.getMainFlakePath(repoRoot);
  const flakeRelativePath = getRelativePath(flakePath, repoRoot);
  const templatePath = `${templatesRootDir}/nix/${flake.MAIN_FLAKE_FILE_NAME}`;
  // main flake already exists, ask user before overwriting it
  if (checkFile(flakePath)) {
    const shouldOverwriteFlakeFile = gum.confirm({
      prompt: `File ${style.highlight(
        flakeRelativePath
      )} already exists at the root of the git repository. Do you want to overwite it ?`,
    });
    if (!shouldOverwriteFlakeFile) {
      std.err.puts(`${style.formatAbortMessage()}\n`);
      return abort(1);
    }
  }
  // ask flake description
  const flakeDescription = askFlakeDescription(packageName);
  // create flake
  std.err.puts(
    style.formatStepHeader(`Creating ${style.highlight(flakeRelativePath)}... `)
  );
  std.err.flush();
  try {
    flake.createMainFlake(flakePath, templatePath, flakeDescription);
    git.addEntries(repoRoot, [flakePath]);
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  return flakePath;
};

/**
 * @param {string} repoRoot
 * @param {string} templatesRootDir - path to the root directory containing templates in the nix store
 *
 * @returns {string} qel flake path
 */
export const ensureQelFlake = (repoRoot, templatesRootDir) => {
  const flakePath = flake.getQelFlakePath(repoRoot);
  const flakeRelativePath = getRelativePath(flakePath, repoRoot);
  const templatePath = `${templatesRootDir}/nix/${flake.QEL_FLAKE_FILE_NAME}`;
  if (checkFile(flakePath)) {
    return flakePath;
  }
  // create flake
  std.err.puts(
    style.formatStepHeader(`Creating ${style.highlight(flakeRelativePath)}... `)
  );
  std.err.flush();
  try {
    flake.createQelFlake(flakePath, templatePath);
    git.addEntries(repoRoot, [flakePath]);
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  return flakePath;
};

/**
 * @param {string} repoRoot
 * @param {string} extDir - path to the "ext" directory in the nix store
 *
 * @returns {string} src directory path
 */
export const ensureSrcDirectory = (repoRoot, extDir) => {
  const srcDirPath = getSrcDirPath(repoRoot);
  const srcDirRelativePath = getRelativePath(srcDirPath, repoRoot);

  /*
    Create "src" directory if needed
   */
  // @ts-ignore
  const [_, err] = os.stat(srcDirPath);
  if (err) {
    std.err.puts(
      style.formatStepHeader(
        `Creating ${style.highlight(srcDirRelativePath)} directory... `
      )
    );
    // @ts-ignore
    const errCode = os.mkdir(srcDirPath);
    if (errCode < 0) {
      std.err.puts(`${style.formatStepFailureEmoji()}\n`);
      std.err.puts(
        `  ${style.formatStepError(
          `Could not create directory (${errCode})\n`
        )}`
      );
      return abort(1);
    }
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  }

  /*
    Create "ext" symlink if needed
   */
  const extSymlinkPath = `${srcDirPath}/ext`;
  const extSymlinkRelativePath = getRelativePath(extSymlinkPath, repoRoot);
  if (!checkFile(extSymlinkPath)) {
    std.err.puts(
      style.formatStepHeader(
        `Creating ${style.highlight(extSymlinkRelativePath)} symlink... `
      )
    );
    // @ts-ignore
    os.remove(extSymlinkPath);
    // @ts-ignore
    const errCode = os.symlink(extDir, extSymlinkPath);
    if (errCode !== 0) {
      std.err.puts(`${style.formatStepFailureEmoji()}\n`);
      std.err.puts(
        `  ${style.formatStepError(`Symlink creation failed (${errCode})`)}\n`
      );
      return abort(1);
    }
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
    std.err.flush();
  }

  /*
    Check .gitignore
   */
  const gitIgnorePath = `${srcDirPath}/.gitignore`;
  const gitIgnoreRelativePath = getRelativePath(gitIgnorePath, repoRoot);
  std.err.puts(
    style.formatStepHeader(
      `Checking ${style.highlight(gitIgnoreRelativePath)}... `
    )
  );

  // add "/ext" if needed
  const searchLine = '/ext';
  const lines =
    /** @type {string} */ (std.loadFile(gitIgnorePath))
      ?.trim()
      .split('\n')
      .map((e) => e.trim()) ?? [];
  if (!lines.includes(searchLine)) {
    lines.push(searchLine);
    try {
      writeFile(gitIgnorePath, `${lines.join('\n')}\n`);
    } catch (e) {
      std.err.puts(`${style.formatStepFailureEmoji()}\n`);
      std.err.puts(`  ${style.formatStepError(e.message)}\n`);
      return abort(1);
    }
  }

  // add ".gitignore"
  try {
    git.addEntries(repoRoot, [gitIgnorePath]);
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
  std.err.flush();

  return srcDirPath;
};

/**
 * @param {string[]} modules
 *
 * @returns {string}
 */
export const getTemplateFilenameFromLibModules = (modules) => {
  if (modules.includes('arg')) {
    if (modules.includes('curl')) {
      if (modules.includes('gum')) {
        return 'arg_curl_gum.js';
      }
      return 'arg_curl.js';
    }
    return 'arg.js';
  }
  if (modules.includes('curl')) {
    if (modules.includes('gum')) {
      return 'curl_gum.js';
    }
    return 'curl.js';
  }
  if (modules.includes('gum')) {
    return 'gum.js';
  }
  return 'default.js';
};

/**
 * @param {string[]} modules
 *
 * @returns {string[]}
 */
export const getRuntimeDepsFromLibModules = (modules) => {
  /** @type {string[]} */
  const runtimeDeps = [];
  if (modules.includes('curl')) {
    runtimeDeps.push('curl');
  }
  if (modules.includes('gum')) {
    runtimeDeps.push('gum');
  }
  return runtimeDeps;
};

/**
 * @param {string} repoRoot
 * @param {string} scriptFilename
 *
 * @returns {string}
 */
export const getScriptPath = (repoRoot, scriptFilename) => {
  const srcDirPath = getSrcDirPath(repoRoot);
  return `${srcDirPath}/${scriptFilename}`;
};

/**
 * @param {string} repoRoot
 *
 * @returns {string}
 */
const getSrcDirPath = (repoRoot) => {
  return `${repoRoot}/${SRC_DIR_NAME}`;
};

/** @typedef {import('./config.js').Script} Script */

/**
 * @param {string} repoRoot
 * @param {string} configPath
 * @param {string} templatesRootDir - path to the root directory containing templates in the nix store
 * @param {string} extDir - path to the "ext" directory in the nix store
 *
 * @returns {Script} new script
 */
export const addScript = (repoRoot, configPath, templatesRootDir, extDir) => {
  const srcDirPath = ensureSrcDirectory(repoRoot, extDir);
  const relativeConfigPath = getRelativePath(configPath, repoRoot);

  const scriptName = askScriptName();
  const libModules = chooseLibModules();
  const runtimeDeps = getRuntimeDepsFromLibModules(libModules);

  const updateConfigStepHeader = style.formatStepHeader(
    `Updating ${style.highlight(relativeConfigPath)}... `
  );

  // load config
  let cfg = undefined;
  try {
    cfg = config.loadConfig(configPath);
  } catch (e) {
    std.err.puts(updateConfigStepHeader);
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }

  // check if script exists
  let script = config.getScript(cfg, scriptName);
  /** @type {string|undefined} */
  let scriptPath;
  if (script) {
    scriptPath = `${srcDirPath}/${script.file}`;
    if (checkFile(scriptPath)) {
      const shouldOverwriteScript = gum.confirm({
        prompt: `A script named ${style.highlight(
          script.name
        )} already exists. Do you want to overwrite it ?`,
      });
      if (!shouldOverwriteScript) {
        std.err.puts(`${style.formatAbortMessage()}\n`);
        return abort(1);
      }
    }
    script.runtimeDeps = runtimeDeps;
  } else {
    script = config.addScript(cfg, scriptName, { runtimeDeps });
    scriptPath = `${srcDirPath}/${script.file}`;
  }
  const scriptRelativePath = getRelativePath(scriptPath, repoRoot);

  // save config
  try {
    config.saveConfig(cfg, configPath);
    git.addEntries(repoRoot, [configPath]);
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  std.err.puts(updateConfigStepHeader);
  std.err.puts(`${style.formatStepSuccessEmoji()}\n`);

  // create script
  std.err.puts(
    style.formatStepHeader(
      `Creating ${style.highlight(scriptRelativePath)} script... `
    )
  );
  std.err.flush();
  const templateFileName = getTemplateFilenameFromLibModules(libModules);
  const templatePath = `${templatesRootDir}/js/${templateFileName}`;
  if (!checkFile(templatePath)) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(
      `  ${style.formatStepError(`Template ${templateFileName} not found`)}\n`
    );
    return abort(1);
  }
  const content = std.loadFile(templatePath);
  try {
    writeFile(scriptPath, content);
    git.addEntries(repoRoot, [scriptPath]);
  } catch (e) {
    std.err.puts(`${style.formatStepFailureEmoji()}\n`);
    std.err.puts(`  ${style.formatStepError(e.message)}\n`);
    return abort(1);
  }
  std.err.puts(`${style.formatStepSuccessEmoji()}\n`);

  // update lock file
  const lockFilePath = flake.getMainFlakeLockPath(repoRoot);
  if (!checkFile(lockFilePath)) {
    const lockFileRelativePath = getRelativePath(lockFilePath, repoRoot);
    std.err.puts(
      style.formatStepHeader(
        `Creating ${style.highlight(lockFileRelativePath)} script... `
      )
    );
    std.err.flush();
    try {
      flake.ensureMainFlakeLock(repoRoot);
      git.addEntries(repoRoot, [lockFilePath]);
    } catch (e) {
      std.err.puts(`${style.formatStepFailureEmoji()}\n`);
      std.err.puts(`  ${style.formatStepError(e.message)}\n`);
      return abort(1);
    }
    std.err.puts(`${style.formatStepSuccessEmoji()}\n`);
  }

  return script;
};
