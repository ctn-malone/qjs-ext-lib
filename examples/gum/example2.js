/** @format */
// @ts-check

// @ts-ignore
import * as std from 'std';

import { execSync } from '../../src/process.js';
import * as gum from '../../src/gum.js';

/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * @format
 * @template T
 * @param {T} value
 */
export const notNull = (value) => {
  // Use `==` to check for both null and undefined
  if (value == null) {
    throw new Error(`Did not expect value to be null or undefined`);
  }
  return value;
};

/*
  Heavily inspired by https://github.com/charmbracelet/gum/blob/main/examples/git-branch-manager.sh
 */

const GIT_COLOR = '#f14e32';

const ensureGitRepo = () => {
  try {
    execSync('git rev-parse --git-dir', {
      passStderr: false,
    });
  } catch (e) {
    return false;
  }
  return true;
};

/**
 * @param {string} text
 *
 * @returns {string}
 */
const gitColorText = (text) => {
  return gum.style(text, {
    foreground: GIT_COLOR,
  });
};

const abort = () => {
  console.log(`All right, nothing more to do!`);
  std.exit(0);
};

const displayHeader = () => {
  console.log(
    gum.style(`${gitColorText(' Git')} Branch manager`, {
      border: gum.Border.NORMAL,
      marginTop: 1,
      marginBottom: 1,
      paddingTop: 1,
      paddingBottom: 1,
      borderForeground: GIT_COLOR,
    })
  );
};

/**
 * @param {string[]} branches
 *
 * @returns {string[]}
 */
const chooseBranches = (branches) => {
  console.log(`Choose ${gitColorText('branches')} to operate on:`);
  const selectedBranches = gum.chooseItemsFromList(branches, {
    custom: {
      args: {
        'selected.foreground': GIT_COLOR,
      },
    },
  });
  if (!selectedBranches?.length) {
    abort();
  }
  return notNull(selectedBranches).map((item) => item.value);
};

const chooseAction = () => {
  console.log(`Choose a ${gitColorText('command')}:`);
  const action = gum.chooseItemFromList(['Rebase', 'Delete', 'Update'], {
    custom: {
      args: {
        'cursor.foreground': GIT_COLOR,
      },
    },
  });
  if (!action) {
    abort();
  }
  return notNull(action).value;
};

/**
 * @param {string} branch
 * @param {string[]} branches
 *
 * @returns {boolean}
 */
const rebaseBranch = (branch, branches) => {
  const baseBranch = gum.filterItemFromList(branches, {
    header: `What is your ${gitColorText('base')} branch for ${gitColorText(
      branch
    )} ?`,
    custom: {
      args: {
        'selected-indicator.foreground': GIT_COLOR,
      },
    },
  });
  if (!baseBranch) {
    return false;
  }
  try {
    execSync(`git fetch origin`);
    execSync(`git checkout ${branch}`);
    execSync(`git rebase origin/${baseBranch}`);
    console.log(
      `Branch ${gitColorText(branch)} successfully rebased on ${gitColorText(
        baseBranch.value
      )}.`
    );
  } catch (e) {}
  std.out.puts(`Press ${gitColorText('Enter')} for next branch.`);
  std.out.flush();
  std.in.getline();
  return true;
};

const main = async () => {
  if (!gum.hasGum()) {
    console.log(
      `Looks like gum binary is missing. You can download it from https://github.com/charmbracelet/gum.`
    );
    std.exit(1);
  }
  if (!ensureGitRepo()) {
    console.log(
      `This script must be run in a ${gitColorText('git')} repository.`
    );
    std.exit(1);
  }
  displayHeader();
  const branches = execSync('git branch --format=%(refname:short)')
    .split('\n')
    .map((b) => b.trim());
  const selectedBranches = chooseBranches(branches);
  const action = chooseAction();
  for (const branch of selectedBranches) {
    switch (action) {
      case 'Rebase':
        if (!rebaseBranch(branch, branches)) {
          abort();
        }
        break;
      case 'Delete':
        try {
          execSync(`git branch -D ${branch}`);
          console.log(`Branch ${gitColorText(branch)} successfully deleted`);
        } catch (e) {}
        break;
      case 'Update':
        try {
          execSync(`git checkout ${branch}`);
          execSync(`git pull --ff-only`);
          console.log(`Branch ${gitColorText(branch)} successfully updated.`);
        } catch (e) {}
        break;
    }
  }
  abort();
};

main();
