/** @format */
// @ts-check
import * as std from './ext/std.js';
import * as os from './ext/os.js';

import arg from './ext/arg.js';
import * as config from './lib/config.js';
import * as git from './lib/git.js';
import { CONFIG_FILE_NAME } from './lib/config.js';
import { highlight } from './lib/style.js';
import { notNull } from './ext/types.js';

/*
  This script is meant to be called from within a nix shell
  It relies on two environment variables to work properly

  - QEL_TEMPLATES_ROOT_DIR: full path to the root directory containing templates, inside nix store
 */

const SCRIPT_NAME = 'qel-completion.sh';

const DEFAULT_FUNCTION_NAME = '_qel_completion';

const templatesRootDir = std.getenv('QEL_TEMPLATES_ROOT_DIR');
if (!templatesRootDir) {
  std.err.puts(
    `Missing ${highlight('QEL_TEMPLATES_ROOT_DIR')} environment variable\n`
  );
  std.exit(2);
}

const args = arg
  .parser({
    '--config': arg
      .path()
      .check()
      .desc(
        `path to the '${CONFIG_FILE_NAME}' file (by default, use the '${CONFIG_FILE_NAME}' file at the root of the git repository)`
      ),
    '--shell': arg
      .str('bash')
      .enum(['bash', 'zsh'])
      .desc('shell to generate completion for')
      .env('QEL_COMPLETION_SHELL')
      .val('NAME'),
    '--function-name': arg
      .str(DEFAULT_FUNCTION_NAME)
      .env('QEL_COMPLETION_FUNCTION_NAME')
      .val('NAME')
      .desc('name of the shell function used for completion')
      .cust((value) => {
        if (!value.startsWith('_')) {
          throw new Error(`function name should start with "_"`);
        }
      }),
    '--randomize-function-name': arg
      .flag(true)
      .env('QEL_COMPLETION_RANDOMIZE_FUNCTION_NAME')
      .desc(
        'if set, a randomize value will be added at the end of the function name'
      ),
    '--function': arg
      .flag(true)
      .desc('if set, output completion function')
      .env('QEL_COMPLETION_ENABLE_FUNCTION'),
    '--setup': arg
      .flag(true)
      .desc('if set, output completion setup for each script')
      .env('QEL_COMPLETION_ENABLE_SETUP'),
    '--release': arg
      .flag(true)
      .desc(
        'if set, output completion setup for "release" (ie: compiled) scripts (ignored if --setup is not set)'
      )
      .env('QEL_COMPLETION_SETUP_FOR_RELEASE'),
    '--dev': arg
      .flag()
      .desc(
        'if set, output completion setup for "dev" (ie: .js) scripts (ignored if --setup is not set)'
      )
      .env('QEL_COMPLETION_SETUP_FOR_DEV'),
    '-c': '--config',
    '-s': '--shell',
  })
  .ex([
    '-s zsh',
    '-s zsh --dev',
    '--function-name _my_completion_function',
    '--no-setup',
  ])
  .desc('Output shell completion to stdout')
  .parse({
    scriptName: SCRIPT_NAME,
  });

// @ts-ignore
let configFilePath = args.get('--config');
if (!configFilePath) {
  const curDir = os.getcwd()[0];
  try {
    const repoRoot = git.getRoot(curDir);
    configFilePath = `${repoRoot}/${CONFIG_FILE_NAME}`;
  } catch (e) {
    std.err.puts(e.message);
    std.exit(2);
  }
}
if (!os.stat(configFilePath)[0]) {
  std.err.puts(`Config file ${configFilePath} does not exist`);
  std.exit(2);
}

if (!args.get('--setup') && !args.get('--function')) {
  args.usage(`At least one of (--function, --setup) should be set`);
}

/**
 * @param {'bash' | 'zsh'} shell
 * @param {string} functionName
 *
 * @returns {string}
 */
const generateFunction = (shell, functionName) => {
  let filepath = `${templatesRootDir}/completion/function.bash`;
  if (shell === 'zsh') {
    filepath = `${templatesRootDir}/completion/function.zsh`;
  }
  let content = notNull(std.loadFile(filepath)).trim();
  // replace function name
  content = content.replace(`${DEFAULT_FUNCTION_NAME}()`, `${functionName}()`);
  return content;
};

/**
 * @param {'bash' | 'zsh'} shell
 * @param {string} functionName
 * @param {string[]} commands
 *
 * @returns {string}
 */
const generateSetup = (shell, functionName, commands) => {
  const lines = commands.map((command) => {
    if (shell === 'zsh') {
      return `compdef ${functionName} ${command}`;
    }
    return `complete -F ${functionName} ${command}`;
  });
  return lines.join('\n');
};

const main = async () => {
  const cfg = config.loadConfig(configFilePath);
  const shell = args.get('--shell');

  /** @type {string[]} */
  const commands = [];
  for (const script of cfg.scripts) {
    if (script.completion !== true) {
      continue;
    }
    if (args.get('--dev')) {
      commands.push(script.file);
    }
    if (args.get('--release')) {
      commands.push(script.name);
    }
  }
  if (!commands.length) {
    std.exit(0);
  }

  let functionName = args.get('--function-name');
  if (args.get('--randomize-function-name')) {
    functionName += `_${Date.now()}`;
  }

  let content = '';
  if (args.get('--setup')) {
    // add comment on first line for zsh compinit
    if (shell === 'zsh') {
      content += `#compdef ${commands.join(' ')}\n`;
    }
  }
  if (args.get('--function')) {
    content += `\n${generateFunction(shell, functionName)}\n`;
  }
  if (args.get('--setup')) {
    content += `\n${generateSetup(shell, functionName, commands)}\n`;
  }
  std.out.puts(`${content.trim()}\n`);
  std.exit(0);
};
main().catch((e) => {
  std.err.puts(e.message);
  std.exit(1);
});
