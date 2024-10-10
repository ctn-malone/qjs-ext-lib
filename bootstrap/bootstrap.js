/** @format */
// @ts-check

import * as std from './ext/std.js';
import * as os from './ext/os.js';

import arg from './ext/arg.js';
import * as ui from './lib/ui.js';
import { highlight, bold } from './lib/style.js';
import { getRelativePath } from './lib/utils.js';

/*
  This script is meant to be called from within a nix shell
  It relies on two environment variables to work properly

  - QEL_EXT_DIR: full path to the ext directory of the library, inside nix store
  - QEL_TEMPLATES_ROOT_DIR: full path to the root directory containing templates, inside nix store
 */

const SCRIPT_NAME = 'qel-bootstrap.sh';

const templatesRootDir = std.getenv('QEL_TEMPLATES_ROOT_DIR');
if (!templatesRootDir) {
  std.err.puts(
    `Missing ${highlight('QEL_TEMPLATES_ROOT_DIR')} environment variable\n`
  );
  std.exit(2);
}
const extDir = std.getenv('QEL_EXT_DIR');
if (!extDir) {
  std.err.puts(`Missing ${highlight('QEL_EXT_DIR')} environment variable\n`);
  std.exit(2);
}

// @ts-ignore
const curDir = os.getcwd()[0];

const args = arg
  .parser({
    '--dir': arg
      .path(curDir)
      .dir()
      .ensure()
      .desc('root directory of the project'),
    '-d': '--dir',
  })
  .ex(['--dir /tmp/new-project'])
  .desc('Initialize a new project or add a new script to an existing project')
  .parse({
    scriptName: SCRIPT_NAME,
  });

const repoRoot = ui.ensureGitRepo(args.get('--dir'));
const configPath = ui.ensureConfig(
  repoRoot,
  /** @type {string} */ (templatesRootDir)
);
const script = ui.addScript(
  repoRoot,
  configPath,
  /** @type {string} */ (templatesRootDir),
  /** @type {string} */ (extDir)
);

const scriptPath = ui.getScriptPath(repoRoot, script.file);
const scriptRelativePath = getRelativePath(scriptPath, curDir);
const repoRootRelativePath = repoRoot === curDir ? '.' : repoRoot;

std.err.puts(
  `\nIn order to execute the ${highlight(
    script.name
  )} script, run one of the following commands :\n\n`
);
std.err.puts(
  `- from within a ${bold('nix dev shell')} : ${highlight(
    `qjs.sh ${scriptRelativePath}`
  )}\n`
);
std.err.puts(
  `- otherwise : ${highlight(
    `nix run ${repoRootRelativePath}#${script.name}`
  )}\n`
);
