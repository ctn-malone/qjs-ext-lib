/** @format */

// @ts-check
import * as os from './os.js';
import * as std from './std.js';
import { Process, ProcessSync } from './process.js';
import { strToBytesArray } from './strings.js';
import * as path from './path.js';

const TMP_PREFIX = 'qel-';

/**
 * Wait until the lock is acquired
 *
 * @param {string} filepath
 *
 * @returns {Promise<() => void>}
 */
const waitForLockUsingBinary = (filepath) => {
  const promise = new Promise((resolve, reject) => {
    const stdinPipe = os.pipe();
    if (stdinPipe === null) {
      // @ts-ignore
      reject(new InternalError(`Could not create stdin pipe`));
      return;
    }
    const p = new Process(['flock', '-x', filepath, 'cat'], {
      stdin: stdinPipe[0],
    });
    const bytesArray = strToBytesArray('\n');
    let gotStdOut = false;
    p.setEventListener('stdout', () => {
      gotStdOut = true;
      resolve(() => {
        os.close(stdinPipe[1]);
      });
    });
    p.setEventListener('exit', (state) => {
      if (!gotStdOut) {
        let errMessage = `Call to flock binary failed (${state.exitCode})`;
        const stderr = p.stderr;
        if (stderr) {
          errMessage += `: ${stderr}`;
        }
        reject(errMessage);
      }
    });
    p.run();
    os.close(stdinPipe[0]);
    os.write(
      stdinPipe[1],
      /** @type {ArrayBuffer} */ (bytesArray.buffer),
      0,
      bytesArray.length,
    );
  });
  return promise;
};

/**
 * Wait until the lock is acquired
 *
 * @param {number} fd - file descriptor
 *
 * @returns {Promise<void>}
 */
const waitForLockUsingFunction = async (fd) => {
  let ret;
  while ((ret = os.flock(fd, os.LOCK_EX | os.LOCK_NB)) !== 0) {
    if (-ret !== std.Error.EWOULDBLOCK) {
      // @ts-ignore
      throw new InternalError(
        `Call to flock function failed (${-ret}): ${std.strerror(-ret)}`,
      );
    }
    await os.sleepAsync(100);
  }
};

/**
 * Run a promise while holding a lock.
 *
 * @template T
 * @param {string} filepath - lock file path
 * @param {() => Promise<T>} callback
 *
 * @returns {Promise<T>}
 */
export const withExclusiveLock = async (filepath, callback) => {
  const fd = os.open(filepath, os.O_RDONLY | os.O_CREAT, 0o644);
  if (fd < 0) {
    // @ts-ignore
    throw new InternalError(`Cannot access ${filepath}`);
  }
  /** @type {(() => void) | undefined} */
  let releaseLock = undefined;
  try {
    if (typeof os.flock === 'function') {
      await waitForLockUsingFunction(fd);
    } else {
      releaseLock = await waitForLockUsingBinary(filepath);
    }
    return await callback();
  } finally {
    os.close(fd);
    if (releaseLock) {
      releaseLock();
    }
  }
};

/**
 * @typedef MktempOptions
 * @property {string} [directory] - parent directory for the temporary file
 */

/**
 * Create a temporary file
 *
 * @param {MktempOptions} [options] - options for the temporary file
 *
 * @returns {string} - path to the temporary file
 */
export const mktemp = (options) => {
  const tmpDir = path.getTmpDir();
  const { directory = tmpDir } = options || {};
  const prefix = path.join(directory, `${TMP_PREFIX}XXXXXX`);
  if (typeof os.mkstemp === 'function') {
    const output = { filename: '' };
    const fd = os.mkstemp(prefix, output);
    if (fd < 0) {
      // @ts-ignore
      throw new InternalError(
        `Could not create temporary file (${-fd}): ${std.strerror(-fd)}`,
      );
    }
    os.close(fd);
    return output.filename;
  }
  const p = new ProcessSync(['mktemp', prefix], {
    passStderr: false,
  });
  p.run();
  if (p.exitCode !== 0) {
    let errMessage = `Could not create temporary file (${p.exitCode})`;
    const stderr = p.stderr;
    if (stderr) {
      errMessage += `: ${stderr}`;
    }
    // @ts-ignore
    throw new InternalError(errMessage);
  }
  return p.stdout;
};

/**
 * @typedef MkdtempOptions
 * @property {string} [directory] - parent directory for the temporary directory
 */

/**
 * Create a temporary directory
 *
 * @param {MkdtempOptions} [options] - options for the temporary directory
 *
 * @returns {string} - path to the temporary directory
 */
export const mkdtemp = (options) => {
  const tmpDir = path.getTmpDir();
  const { directory = tmpDir } = options || {};
  const prefix = path.join(directory, `${TMP_PREFIX}XXXXXX`);
  if (typeof os.mkdtemp === 'function') {
    const errObj = { errno: 0 };
    const dirpath = os.mkdtemp(prefix, errObj);
    if (dirpath === null) {
      // @ts-ignore
      throw new InternalError(
        `Could not create temporary directory (${errObj.errno}): ${std.strerror(errObj.errno)}`,
      );
    }
    return dirpath;
  }
  const p = new ProcessSync(['mktemp', '-d', prefix], {
    passStderr: false,
  });
  p.run();
  if (p.exitCode !== 0) {
    let errMessage = `Could not create temporary directory (${p.exitCode})`;
    const stderr = p.stderr;
    if (stderr) {
      errMessage += `: ${stderr}`;
    }
    // @ts-ignore
    throw new InternalError(errMessage);
  }
  return p.stdout;
};
