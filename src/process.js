/** @format */
// @ts-check
'use strict;';

/*
  Execute external processes asynchronously
 */

import * as os from './os.js';
import * as std from './std.js';

import { bytesArrayToStr, getLines, strToBytesArray } from './strings.js';
import { wait } from './timers.js';

/**
 * Parse a command line into an array of arguments
 *
 * @param {string} command - command line to parse
 *
 * @returns {string[]} arguments
 */
const parseArgs = (command) => {
  // NB: regexp will fail in case an orphan quote or double quote exists
  const args = command.match(/[^"' \t]+|["'](?:\\["']|[^"'])*['"]/g);
  if (!args) {
    throw new TypeError(`Could not parse command line '${command}'`);
  }
  return args.map((e) => {
    // remove enclosing double quotes
    if (e.startsWith('"') && e.endsWith('"')) {
      return e.slice(1, -1);
    }
    // remove enclosing single quotes
    if (e.startsWith("'") && e.endsWith("'")) {
      return e.slice(1, -1);
    }
    return e;
  });
};

/**
 * @typedef {Object} ProcessState
 * @property {number} pid
 * @property {number} exitCode - exit code of the process
 * @property {boolean} didTimeout - whether or not process was killed after timeout
 * @property {string} [signal] - signal name (only defined if process was terminated using a signal)
 */

/**
 * Convert signal value to name
 *
 * @param {number} signal - signal number
 *
 * @returns {string|undefined}
 */
const getSignalName = (signal) => {
  // use values defined in 'include/bits/signal.h' (musl lib)
  if (signal < 0) {
    signal = -signal;
  }
  switch (signal) {
    case os.SIGHUP:
      return 'SIGHUP';
    case os.SIGINT:
      return 'SIGINT';
    case os.SIGQUIT:
      return 'SIGQUIT';
    case os.SIGABRT:
      return 'SIGABRT';
    case os.SIGKILL:
      return 'SIGKILL';
    case os.SIGTERM:
      return 'SIGTERM';
  }
};

/**
 * @param {number} signal
 *
 * @returns  {boolean}
 */
const _isTerminationSignal = (signal) => {
  // see https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html
  switch (signal) {
    case os.SIGTERM:
    case os.SIGINT:
    case os.SIGQUIT:
    case os.SIGKILL:
      return true;
  }
  return false;
};

/**
 * @readonly
 * @enum {string}
 */
export const ProcessEvent =
  /** @type {{STDOUT: 'stdout', STDERR: 'stderr', EXIT: 'exit', PAUSE: 'pause', RESUME: 'resume'}} */ ({
    STDOUT: 'stdout',
    STDERR: 'stderr',
    EXIT: 'exit',
    PAUSE: 'pause',
    RESUME: 'resume',
  });

/**
 * @typedef {Object} ProcessStdoutStderrEventPayload
 * @property {number} pid
 * @property {string} data
 * @property {number} timestamp
 */

/**
 * @callback ProcessStdoutStderrEventCallback
 * @param {ProcessStdoutStderrEventPayload} payload
 */

/**
 * @typedef {Object} ProcessPauseResumeEventPayload
 * @property {number} pid
 */

/**
 * @callback ProcessPauseResumeEventCallback
 * @param {ProcessPauseResumeEventPayload} payload
 */

/**
 * @typedef {ProcessState} ProcessExitEventPayload
 */

/**
 * @callback ProcessExitEventCallback
 * @param {ProcessExitEventPayload} payload
 */

/**
 * @typedef {{
 *   stdout: ProcessStdoutStderrEventPayload;
 *   stderr: ProcessStdoutStderrEventPayload;
 *   exit: ProcessExitEventPayload;
 *   pause: ProcessPauseResumeEventPayload;
 *   resume: ProcessPauseResumeEventPayload;
 * }} ProcessEventPayloadMap
 */

/**
 * @typedef {Object} KillOptions
 * @property {number} [signal=os.SIGTERM] - signal number to use (default = os.SIGTERM)
 * @property {boolean} [recursive=false] - if true, send the signal to child processes recursively (default = false)
 */

const DEFAULT_SHELL = '/bin/sh';
const SETSID_BINARY = '/usr/bin/setsid';
const DEFAULT_BUFFER_SIZE = 512;

class Process {
  /**
   * Constructor
   *
   * @param {string[]|string} cmdline - command line to execute. If a {string} is passed, it will be splitted into a {string[]}
   * @param {object} [opt] - options
   * @param {boolean} [opt.usePath=true] -  if {true}, the file is searched in the PATH environment variable (default = {true})
   * @param {string} [opt.cwd] - set the working directory of the new process
   * @param {number} [opt.uid] - if defined, process uid will be set using setuid
   * @param {number} [opt.gid] - if defined, process gid will be set using setgid
   * @param {object} [opt.env] - define child process environment (if not defined, use the environment of parent process)
   * @param {boolean} [opt.replaceEnv=true] - if {true}, ignore parent environment when setting child environment (default = {true})
   * @param {boolean} [opt.useShell=false] - if {true}, run command using '/bin/sh -c' (default = {false})
   * @param {string} [opt.shell="/bin/sh"] - full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
   * @param {boolean} [opt.newSession=false] - if {true} setsid will be used (ie: child will not receive SIGINT sent to parent) (default = {false})
   * @param {boolean} [opt.passStderr=false] - if {true} stderr will not be intercepted (default = {false})
   *                                           Ignored if {opt.stdout} is set or {opt.streamStdout} is {false}
   * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false})
   *                                               Ignored if {opt.passStderr} is {true}, {opt.stdout} is set or {opt.streamStdout} is {false}
   * @param {boolean} [opt.lineBuffered=false] - if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
   * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
   * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
   * @param {number} [opt.timeout] - maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
   * @param {number} [opt.timeoutSignal=os.SIGTERM] - signal to use when killing the child after timeout (default = os.SIGTERM, ignored if {opt.timeout} is not defined)
   * @param {number} [opt.stdin] - if defined, sets the stdin handle used by child process (it will be rewind)
   *                                NB: don't share the same handle between multiple instances
   * @param {string} [opt.input] - content which will be used as input (will be ignored if {stdin} is set)
   * @param {number} [opt.stdout] - if defined, sets the stdout handle used by child process (it will be rewind)
   *                                NB: - don't share the same handle between multiple instances
   *                                    - stdout event handler will be ignored
   *                                    - stderr redirection will be ignored
   *                                    - {opt.passStderr} will be ignored
   * @param {boolean} [opt.streamStdout=true] - whether or not streaming should be enabled (default = {true}, ignored if {opt.stdout} is set)
   *                                            NB: when set to {false}
   *                                              - stdout event handler will be ignored
   *                                              - stderr redirection will be ignored
   *                                              - {opt.passStderr} will be ignored
   * @param {number} [opt.bufferSize=512] - size (in bytes) of the buffer used to read from process stdout & stderr streams (default = {512})
   * @param {object} [opt.props] - custom properties
   */
  constructor(cmdline, opt) {
    if (undefined === opt) {
      opt = {};
    }

    /*
      command
     */
    /** @private */
    this._cmdline = '';
    /**
     * @private
     * @type {string[] | undefined}
     */
    this._args = undefined;
    if (Array.isArray(cmdline)) {
      if (0 != cmdline.length) {
        this._cmdline = cmdline.join(' ');
        this._args = [...cmdline];
      }
    }
    // consider it is a string
    else if ('string' == typeof cmdline) {
      this._cmdline = cmdline.trim();
      this._args = parseArgs(this._cmdline);
    }
    if ('' == this._cmdline) {
      throw new TypeError(`Argument 'cmdline' cannot be empty`);
    }

    /*
      pid & state
     */
    /** @private */
    this._didStart = false;
    /** @private */
    this._didStop = false;
    /** @private */
    this._promise = undefined;
    /**
     * @private
     * @type {ProcessState}
     */
    this._state = {
      pid: 0,
      exitCode: 0,
      didTimeout: false,
    };
    // whether or not process was paused
    /** @private */
    this._paused = false;

    /*
      callbacks
     */
    /**
     * @private
     * @type {{
     *   stdout: ProcessStdoutStderrEventCallback | undefined,
     *   stderr: ProcessStdoutStderrEventCallback | undefined,
     *   exit: ProcessExitEventCallback | undefined,
     *   pause: ProcessPauseResumeEventCallback | undefined,
     *   resume: ProcessPauseResumeEventCallback | undefined,
     * }}
     */
    this._cb = {
      stdout: undefined,
      stderr: undefined,
      exit: undefined,
      pause: undefined,
      resume: undefined,
    };

    /*
      output
     */
    /** @private */
    this._passStderr = true === opt.passStderr;
    /** @private */
    this._redirectStderr = !this._passStderr && true === opt.redirectStderr;
    /** @private */
    this._output = {
      stdout: '',
      stderr: '',
    };
    // by default don't buffer lines
    /** @private */
    this._lineBuffered = true === opt.lineBuffered;
    // by default trim buffered content
    /** @private */
    this._trim = false !== opt.trim;
    // by default do not skip empty lines
    /** @private */
    this._skipBlankLines = true === opt.skipBlankLines;

    // environment
    let newEnv;
    if (undefined !== opt.env) {
      // initialize with current environment
      if (false === opt.replaceEnv) {
        newEnv = std.getenviron();
      } else {
        newEnv = {};
      }
      // update with the environment passed in opt
      for (const [key, value] of Object.entries(opt.env)) {
        newEnv[key] = value;
      }
    }

    /*
      options
     */
    // qjs options
    /**
     * @private
     * @type {import('./os.js').ExecOptions}
     */
    this._qjsOpt = {
      block: false,
      // by default use PATH
      usePath: false !== opt.usePath,
      cwd: opt.cwd,
      uid: opt.uid,
      gid: opt.gid,
      env: newEnv,
    };
    /** @private */
    this._input = undefined;
    if (undefined !== opt.stdin) {
      this._qjsOpt.stdin = opt.stdin;
    } else if (undefined !== opt.input && 'string' == typeof opt.input) {
      this._input = opt.input;
    }
    /** @private */
    this._stdoutFile = undefined;
    if (undefined !== opt.stdout) {
      this._qjsOpt.stdout = opt.stdout;
    } else if (opt.streamStdout === false) {
      this._stdoutFile = std.tmpfile();
      if (null === this._stdoutFile) {
        // @ts-ignore
        throw new InternalError('Could not create temporary stdout file');
      }
      this._qjsOpt.stdout = /** @type {std.StdFile} */ (
        this._stdoutFile
      ).fileno();
    }
    /*
      If stdout was set, we need to rely on stderr
      to detect the end of the child process
     */
    if (this._qjsOpt.stdout) {
      // disable stderr redirection
      this._redirectStderr = false;
      // disable passStderr
      this._passStderr = false;
    }
    // by default don't use shell
    /** @private */
    this._useShell = { flag: false, shell: DEFAULT_SHELL };
    if (true === opt.useShell) {
      this._useShell.flag = true;
      if (undefined !== opt.shell) {
        this._useShell.shell = opt.shell;
      }
    }
    // by default don't use a new session
    /** @private */
    this._newSession = true === opt.newSession;
    if (true === opt.newSession) {
      this._newSession = true;
    }
    // by default don't use timeout
    /** @private */
    this._timeout = {
      enabled: false,
      delay: 0,
      signal: os.SIGTERM,
    };
    if (undefined !== opt.timeout) {
      const value =
        typeof opt.timeout === 'number' ? opt.timeout : parseInt(opt.timeout);
      if (!isNaN(value) && value > 0) {
        this._timeout.enabled = true;
        this._timeout.delay = value;
        if (undefined !== opt.timeoutSignal) {
          this._timeout.signal = opt.timeoutSignal;
        }
      }
    }

    /** @private */
    this._props = opt.props;
    if (undefined === this._props || 'object' != typeof this._props) {
      this._props = {};
    }

    /** @private */
    this._bufferSize = DEFAULT_BUFFER_SIZE;
    if (undefined !== opt.bufferSize) {
      const value =
        typeof opt.bufferSize === 'number'
          ? opt.bufferSize
          : parseInt(opt.bufferSize);
      if (!isNaN(value) && value > 0) {
        this._bufferSize = value;
      }
    }
  }

  /**
   * Convert signal value to name
   *
   * @param {number} signal - signal number
   *
   * @returns {string|undefined}
   */
  static getSignalName(signal) {
    return getSignalName(signal);
  }

  /**
   * Retrieve full cmd line
   *
   * @returns {string}
   */
  get cmdline() {
    return this._cmdline;
  }

  /**
   * Retrieve full stdout content
   * Will always be empty if a 'stdout' listener was defined
   *
   * @returns {string}
   */
  get stdout() {
    return this._output.stdout;
  }

  /**
   * Retrieve full stderr content
   * Will always be empty if a 'stderr' listener was defined
   *
   * @returns {string}
   */
  get stderr() {
    return this._output.stderr;
  }

  /**
   * Indicate whether or not process is running
   *
   * @returns {boolean}
   */
  get running() {
    return this._didStart && !this._didStop;
  }

  /**
   * Indicate whether or not process is paused
   *
   * @returns {boolean}
   */
  get paused() {
    return this._paused;
  }

  /**
   * Retrieve process state (pid, exitCode ...)
   *
   * @returns {ProcessState}
   */
  get state() {
    return Object.assign({}, this._state);
  }

  /**
   * Indicate whether or not execution succeeded
   *
   * @returns {boolean} {true} if process was started and execution succeeded, {false} otherwise
   */
  get success() {
    if (!this._didStart) {
      return false;
    }
    return 0 == this._state.exitCode;
  }

  /**
   * Retrieve process pid
   *
   * @returns {number}
   */
  get pid() {
    return this._state.pid;
  }

  /**
   * Retrieve custom properties passed in constructor
   *
   * @returns {object}
   */
  get props() {
    return this._props;
  }

  /**
   * Define event handler
   * Any previously defined handler will be replaced
   *
   * @template {keyof ProcessEventPayloadMap} T
   * @param {T} eventType - ProcessEvent.STDOUT | ProcessEvent.STDERR |
   *                        ProcessEvent.PAUSE | ProcessEvent.RESUME |
   *                        ProcessEvent.EXIT
   * @param {(payload: ProcessEventPayloadMap[T]) => void} [cb] - (use {undefined} to disable handler)
   */
  setEventListener(eventType, cb) {
    switch (eventType) {
      case ProcessEvent.STDOUT:
        this._cb.stdout = /** @type {ProcessStdoutStderrEventCallback} */ (cb);
        return;
      case ProcessEvent.STDERR:
        this._cb.stderr = /** @type {ProcessStdoutStderrEventCallback} */ (cb);
        return;
      case ProcessEvent.EXIT:
        this._cb.exit = /** @type {ProcessExitEventCallback} */ (cb);
        return;
      case ProcessEvent.PAUSE:
        this._cb.pause = /** @type {ProcessPauseResumeEventCallback} */ (cb);
        return;
      case ProcessEvent.RESUME:
        this._cb.resume = /** @type {ProcessPauseResumeEventCallback} */ (cb);
        return;
    }
  }

  /**
   * Execute the command line
   *
   * @returns {Promise<ProcessState>} promise which will resolve to an object (see example below)
   */
  /*
        Example output

        If process terminated without signal

        {
           "pid":768754,
           "exitCode":0,
           "didTimeout":false
        }

        If process was terminated after timeout

        {
           "pid":769885,
           "exitCode":-15,
           "didTimeout":true,
           "signal":"SIGTERM"
        }

        If process was terminated with a signal

        {
           "pid":778379,
           "exitCode":-9,
           "didTimeout":false,
           "signal":"SIGKILL"
        }

    */
  run() {
    // do nothing if process is still running
    if (undefined !== this._promise && !this._didStop) {
      return this._promise;
    }
    this._reset();
    this._didStart = true;
    this._promise = new Promise((resolve) => {
      let args;
      // use shell
      if (this._useShell.flag) {
        // use cmdline as a single argument since we're using shell
        args = [this._useShell.shell, '-c', this._cmdline];
      } else {
        args = [...(this._args || [])];
      }

      // use new session
      if (this._newSession) {
        args.unshift(SETSID_BINARY);
      }

      // used to detect timeout
      /** @type {Object | undefined} */
      let timer = undefined;

      /*
        keep track of stream state for both stdout & stderr
       */
      // used to decide whether or not a custom message should be generated
      // if exit code is 127
      let gotStdoutContent = false;
      let gotStderrContent = false;
      // whether or not we reach end of streams
      let endOfStdout = false;
      let endOfStderr = false;
      if (this._redirectStderr || this._passStderr) {
        endOfStderr = true;
      }

      /** @type {[number, number] | null} */
      let stdoutPipe = null;
      /** @type {[number, number] | null} */
      let stderrPipe = null;
      /** @type {[number, number] | null} */
      let stdinPipe = null;

      /**
       * Executed after :
       * - both stdout & stderr are closed if no stdout handle was passed to constructor
       * - stderr is closed if a stdout handle was passed to constructor
       */
      const finalize = () => {
        // remove timer
        if (undefined !== timer) {
          os.clearTimeout(timer);
          timer = undefined;
        }
        const [ret, status] = os.waitpid(this._state.pid);

        /*
          close pipes
         */
        if (null !== stdoutPipe) {
          os.close(stdoutPipe[0]);
        }
        if (null !== stderrPipe) {
          os.close(stderrPipe[0]);
        }
        if (null !== stdinPipe) {
          os.close(stdinPipe[1]);
        }

        if (this._stdoutFile) {
          // read stdout
          this._stdoutFile.flush();
          this._stdoutFile.seek(0, std.SEEK_SET);
          this._output.stdout = this._stdoutFile.readAsString();
          this._stdoutFile.close();
          if ('' != this._output.stdout) {
            // remove empty lines
            if (this._skipBlankLines) {
              this._output.stdout = this._output.stdout.replace(/^\s*\n/gm, '');
            }
            // trim
            if (this._trim) {
              this._output.stdout = this._output.stdout.trim();
            }
          }
        }

        /*
          below code is borrowed from quickjs
         */
        // child terminated normally
        if (!(status & 0x7f)) {
          this._state.exitCode = (status & 0xff00) >> 8;
        }
        // child was terminated by a signal
        else {
          const signal = status & 0x7f;
          this._state.exitCode = -signal;
          this._state.signal = getSignalName(signal);
        }
        // command was not found => check if we need to generate a custom message
        if (127 == this._state.exitCode) {
          const content = 'Command not found';
          // check stderr
          if (!this._redirectStderr && !this._passStderr) {
            // we didn't receive any content on stderr => use custom message
            if (!gotStderrContent) {
              if (undefined !== this._cb.stderr) {
                this._cb.stderr({
                  pid: this._state.pid,
                  data: content,
                  timestamp: Date.now(),
                });
              } else {
                this._output.stderr = content;
              }
            }
          }
          // check stdout (only if no stdout handle was passed to constructor)
          else {
            // we didn't receive any content on stdout => use custom message
            if (!gotStdoutContent) {
              if (undefined !== this._cb.stdout) {
                this._cb.stdout({
                  pid: this._state.pid,
                  data: content,
                  timestamp: Date.now(),
                });
              } else {
                this._output.stdout = content;
              }
            }
          }
        }
        // rewind stdout file descriptor
        if (undefined !== this._qjsOpt.stdout) {
          os.seek(this._qjsOpt.stdout, 0, std.SEEK_SET);
        }
        // call callback
        this._didStop = true;
        const data = Object.assign({}, this._state);
        if (undefined !== this._cb.exit) {
          this._cb.exit(data);
        }
        return resolve(data);
      };

      /*
        process stdout (only if no stdout handle was passed to constructor)
       */
      if (undefined === this._qjsOpt.stdout) {
        stdoutPipe = os.pipe();
        if (null === stdoutPipe) {
          // @ts-ignore
          throw new InternalError(`Could not create stdout pipe`);
        }
        const stdoutBuffer = new Uint8Array(this._bufferSize);
        let stdoutIncompleteLine = {
          data: '',
          timestamp: Date.now(),
        };
        os.setReadHandler(stdoutPipe[0], () => {
          if (0 === this._state.pid) {
            return;
          }

          const timestamp = Date.now();
          const len = os.read(
            /** @type {[number, number]} */ (stdoutPipe)[0],
            stdoutBuffer.buffer,
            0,
            stdoutBuffer.length
          );

          // end of stream
          if (0 == len) {
            os.setReadHandler(
              /** @type {[number, number]} */ (stdoutPipe)[0],
              null
            );
            endOfStdout = true;
            // process incomplete line if needed
            if (undefined !== this._cb.stdout) {
              if (this._lineBuffered && '' != stdoutIncompleteLine.data) {
                this._cb.stdout({
                  pid: this._state.pid,
                  data: stdoutIncompleteLine.data,
                  timestamp: stdoutIncompleteLine.timestamp,
                });
              }
            }
            // update buffered content
            else {
              if ('' != this._output.stdout) {
                // remove empty lines
                if (this._skipBlankLines) {
                  this._output.stdout = this._output.stdout.replace(
                    /^\s*\n/gm,
                    ''
                  );
                }
                // trim
                if (this._trim) {
                  this._output.stdout = this._output.stdout.trim();
                }
              }
            }
            if (endOfStderr) {
              finalize();
            }
            return;
          }

          // process data
          const content = bytesArrayToStr(stdoutBuffer, { from: 0, to: len });
          gotStdoutContent = true;

          // call callbacks
          if (undefined !== this._cb.stdout) {
            if (!this._lineBuffered) {
              this._cb.stdout({
                pid: this._state.pid,
                data: content,
                timestamp: timestamp,
              });
              return;
            }
            const result = getLines(
              content,
              stdoutIncompleteLine.data,
              this._skipBlankLines
            );
            result.lines.forEach((str, i) => {
              /*
                check first line in case we're sending a previously
                incomplete line, to set correct timestamp
               */
              if (0 == i) {
                if ('' != stdoutIncompleteLine.data) {
                  if (undefined !== this._cb.stdout) {
                    this._cb.stdout({
                      pid: this._state.pid,
                      data: str,
                      timestamp: stdoutIncompleteLine.timestamp,
                    });
                  }
                  return;
                }
              }
              if (undefined !== this._cb.stdout) {
                this._cb.stdout({
                  pid: this._state.pid,
                  data: str,
                  timestamp: timestamp,
                });
              }
            });
            stdoutIncompleteLine.data = result.incompleteLine;
            stdoutIncompleteLine.timestamp = timestamp;
            return;
          }
          // buffer output
          this._output.stdout += content;
        });
      }

      /*
        process stderr
       */
      /**
       * @type {Uint8Array<ArrayBuffer> | undefined}
       */
      let stderrBuffer = undefined;
      if (!this._redirectStderr && !this._passStderr) {
        stderrPipe = os.pipe();
        if (null === stderrPipe) {
          // close stdout pipe (only if no stdout handle was passed to constructor)
          if (undefined !== this._qjsOpt.stdout) {
            if (null !== stdoutPipe) {
              os.setReadHandler(stdoutPipe[0], null);
              os.close(stdoutPipe[0]);
              os.close(stdoutPipe[1]);
            }
          }
          // @ts-ignore
          throw new InternalError(`Could not create stderr pipe`);
        }
        stderrBuffer = new Uint8Array(this._bufferSize);
        let stderrIncompleteLine = {
          data: '',
          timestamp: Date.now(),
        };
        os.setReadHandler(stderrPipe[0], () => {
          const timestamp = Date.now();
          const len = os.read(
            /** @type {[number, number]} */ (stderrPipe)[0],
            /** @type {Uint8Array<ArrayBuffer>} */ (stderrBuffer).buffer,
            0,
            /** @type {Uint8Array<ArrayBuffer>} */ (stderrBuffer).length
          );

          // end of stream
          if (0 == len) {
            os.setReadHandler(
              /** @type {[number, number]} */ (stderrPipe)[0],
              null
            );
            endOfStderr = true;
            // process incomplete line if needed
            if (undefined !== this._cb.stderr) {
              if (this._lineBuffered && '' != stderrIncompleteLine.data) {
                this._cb.stderr({
                  pid: this._state.pid,
                  data: stderrIncompleteLine.data,
                  timestamp: stderrIncompleteLine.timestamp,
                });
              }
            }
            // update buffered content
            else {
              if ('' != this._output.stderr) {
                // remove empty lines
                if (this._skipBlankLines) {
                  this._output.stderr = this._output.stderr.replace(
                    /^\s*\n/gm,
                    ''
                  );
                }
                // trim buffered content
                if (this._trim) {
                  this._output.stderr = this._output.stderr.trim();
                }
              }
            }
            if (endOfStdout || undefined !== this._qjsOpt.stdout) {
              finalize();
            }
            return;
          }

          // process data
          const content = bytesArrayToStr(
            /** @type {Uint8Array<ArrayBuffer>} */ (stderrBuffer),
            { from: 0, to: len }
          );
          gotStderrContent = true;

          // call callbacks
          if (undefined !== this._cb.stderr) {
            if (!this._lineBuffered) {
              this._cb.stderr({
                pid: this._state.pid,
                data: content,
                timestamp: timestamp,
              });
              return;
            }
            const result = getLines(
              content,
              stderrIncompleteLine.data,
              this._skipBlankLines
            );
            result.lines.forEach((str, i) => {
              /*
                check first line in case we're sending a previously
                incomplete line, to set correct timestamp
               */
              if (0 == i) {
                if ('' != stderrIncompleteLine.data) {
                  if (undefined !== this._cb.stderr) {
                    this._cb.stderr({
                      pid: this._state.pid,
                      data: str,
                      timestamp: stderrIncompleteLine.timestamp,
                    });
                  }
                  return;
                }
              }
              if (undefined !== this._cb.stderr) {
                this._cb.stderr({
                  pid: this._state.pid,
                  data: str,
                  timestamp: stderrIncompleteLine.timestamp,
                });
              }
            });
            stderrIncompleteLine.data = result.incompleteLine;
            stderrIncompleteLine.timestamp = timestamp;
            return;
          }
          // buffer output
          this._output.stderr += content;
        });
      }

      /*
        create input pipe
       */
      if (undefined !== this._input) {
        stdinPipe = os.pipe();
        if (null === stdinPipe) {
          // close stdout pipe (only if no stdout handle was passed to constructor)
          if (undefined !== this._qjsOpt.stdout) {
            if (null !== stdoutPipe) {
              os.setReadHandler(stdoutPipe[0], null);
              os.close(stdoutPipe[0]);
              os.close(stdoutPipe[1]);
            }
          }
          if (null !== stderrPipe) {
            os.close(stderrPipe[0]);
            os.close(stderrPipe[1]);
          }
          // @ts-ignore
          throw new InternalError(`Could not create stdin pipe`);
        }
      }

      /*
        create process
       */
      const qjsOpt = Object.assign({}, this._qjsOpt);
      if (null !== stdinPipe) {
        qjsOpt.stdin = stdinPipe[0];
      }
      if (undefined !== this._qjsOpt.stdout) {
        // rewind stdout file descriptor
        os.seek(this._qjsOpt.stdout, 0, std.SEEK_SET);
      } else {
        qjsOpt.stdout = /** @type {[number, number]} */ (stdoutPipe)[1];
      }
      if (!this._passStderr) {
        qjsOpt.stderr = qjsOpt.stdout;
      }
      if (null !== stderrPipe) {
        qjsOpt.stderr = stderrPipe[1];
      }
      // rewind stdin file descriptor
      if (undefined !== this._qjsOpt.stdin) {
        os.seek(this._qjsOpt.stdin, 0, std.SEEK_SET);
      }
      this._state.pid = os.exec(args, qjsOpt);

      /*
        close the write ends of the pipes as we don't need them anymore
       */
      // only close pipe if no stdout handle was passed to constructor
      if (undefined === this._qjsOpt.stdout) {
        if (null !== stdoutPipe) {
          os.close(stdoutPipe[1]);
        }
      }
      if (null !== stderrPipe) {
        os.close(stderrPipe[1]);
      }

      /*
        send input
       */
      if (null !== stdinPipe) {
        const bytesArray = strToBytesArray(/** @type {string} */ (this._input));
        os.write(
          stdinPipe[1],
          /** @type {ArrayBuffer} */ (bytesArray.buffer),
          0,
          bytesArray.length
        );
        os.close(stdinPipe[1]);
      }

      /*
        timeout
       */
      if (this._timeout.enabled) {
        timer = os.setTimeout(() => {
          this._state.didTimeout = true;
          this.kill(this._timeout.signal);
        }, 1000 * this._timeout.delay);
      }
    });
    return this._promise;
  }

  /**
   * Wait until process is terminated
   * Will throw an error if process was not started
   *
   * @returns {Promise<ProcessState>} same promise as the one returned by {run} method
   */
  wait() {
    if (undefined === this._promise) {
      const err = new Error(`Process was not started`);
      return Promise.reject(err);
    }
    return this._promise;
  }

  /**
   * Pause child process
   */
  pause() {
    // do nothing if process is not running or is already paused
    if (!this._state.pid || this._didStop || this._paused) {
      return;
    }
    os.kill(this._state.pid, os.SIGSTOP);
    this._paused = true;
    if (undefined !== this._cb.pause) {
      this._cb.pause({
        pid: this._state.pid,
      });
    }
  }

  /**
   * Resume child process
   */
  resume() {
    // do nothing if process is not running or is not paused
    if (!this._state.pid || this._didStop || !this._paused) {
      return;
    }
    os.kill(this._state.pid, os.SIGCONT);
    this._paused = false;
    if (undefined !== this._cb.resume) {
      this._cb.resume({
        pid: this._state.pid,
      });
    }
  }

  /**
   * Kill the process
   *
   * @param {number|KillOptions} [options] - signal number to use (default = {signal: SIGTERM, recursive: false})
   */
  kill(options) {
    // do nothing if process is not running
    if (!this._state.pid || this._didStop) {
      return;
    }
    if (typeof options === 'number') {
      options = { signal: options, recursive: false };
    }
    kill(this._state.pid, options);
    // resume process if it is paused
    if (this._paused && _isTerminationSignal(options?.signal ?? os.SIGTERM)) {
      os.kill(this._state.pid, os.SIGCONT);
    }
  }

  /**
   * Reset internal state. Called at the beginning of {run} method
   *
   * @private
   */
  _reset() {
    this._paused = false;
    this._didStart = false;
    this._didStop = false;
    this._promise = undefined;
    this._state = {
      pid: 0,
      exitCode: 0,
      didTimeout: false,
    };
    this._output = {
      stdout: '',
      stderr: '',
    };
  }
}

/**
 * @typedef {Object} GetChildPidsOptions
 * @property {boolean} [direct=false] - if true, only list direct children (default = false)
 */

/**
 * Find the children of a given process and return their pids
 *
 * @param {number} parentPid
 * @param {GetChildPidsOptions} [options]
 *
 * @return {number[]}
 */
const getChildPids = (parentPid, options) => {
  const { direct = false } = options ?? {};
  /** @type {number[]} */
  const childPids = [];
  /** @type {Set<number>} */
  const knownPids = new Set();
  _getChildPidsRecursively(parentPid, childPids, knownPids, 1, direct ? 1 : 0);
  return childPids;
};

/**
 * @param {number} parentPid
 * @param {number[]} allChildPids
 * @param {Set<number>} knownPids
 * @param {number} depth
 * @param {number} maxDepth - set to 0 to ignore
 */
const _getChildPidsRecursively = (
  parentPid,
  allChildPids,
  knownPids,
  depth,
  maxDepth
) => {
  const threadIds = _getThreadIds(parentPid);
  for (const threadId of threadIds) {
    const childPids = _getChildPidsForThread(parentPid, threadId);
    for (const childPid of childPids) {
      if (knownPids.has(childPid)) {
        continue;
      }
      allChildPids.push(childPid);
      knownPids.add(childPid);
      if (maxDepth && depth >= maxDepth) {
        continue;
      }
      _getChildPidsRecursively(
        childPid,
        allChildPids,
        knownPids,
        depth + 1,
        maxDepth
      );
    }
  }
};

/**
 * @param {number} mainPid
 */
const _getThreadIds = (mainPid) => {
  /** @type {number[]} */
  const threadIds = [];
  const taskDir = `/proc/${mainPid}/task`;
  const [entries, err] = os.readdir(taskDir);

  if (err === 0) {
    for (const entry of entries) {
      const id = parseInt(entry);
      if (isNaN(id) || id < 1) {
        continue;
      }
      threadIds.push(id);
    }
  }
  return threadIds;
};

/**
 * @param {number} mainPid
 * @param {number} threadId
 *
 * @returns {number[]}
 */
const _getChildPidsForThread = (mainPid, threadId) => {
  /** @type {number[]} */
  const childPids = [];
  const childrenFile = `/proc/${mainPid}/task/${threadId}/children`;
  const fd = std.open(childrenFile, 'r');
  if (fd) {
    const content = fd.readAsString().trim();
    fd.close();
    if (content) {
      for (const value of content.split(' ')) {
        const pid = parseInt(value);
        if (isNaN(pid) || pid < 1) {
          continue;
        }
        childPids.push(pid);
      }
    }
  }
  return childPids;
};

/**
 * Send a signal to a given process
 *
 * @param {number} pid - process ID to kill
 * @param {KillOptions} [options] - options object
 */
const kill = (pid, options) => {
  const { signal = os.SIGTERM, recursive = false } = options || {};

  const isTerminationSignal = _isTerminationSignal(signal);

  if (recursive) {
    // pause parent process before killing its children
    if (isTerminationSignal) {
      os.kill(pid, os.SIGSTOP);
    }

    const childPids = getChildPids(pid, { direct: false });
    if (childPids.length) {
      // pause all children before killing them
      if (isTerminationSignal) {
        for (const pid of childPids) {
          os.kill(pid, os.SIGSTOP);
        }
      }
      // send the signal to each child in reverse order
      for (let i = childPids.length - 1; i >= 0; --i) {
        os.kill(childPids[i], signal);
        // unpause child
        if (isTerminationSignal && signal !== os.SIGKILL) {
          os.kill(childPids[i], os.SIGCONT);
        }
      }
    }

    // send signal to parent process and unpause if needed
    os.kill(pid, signal);
    if (isTerminationSignal && signal !== os.SIGKILL) {
      os.kill(pid, os.SIGCONT);
    }
  } else {
    os.kill(pid, signal);
    if (isTerminationSignal && signal !== os.SIGKILL) {
      os.kill(pid, os.SIGCONT);
    }
  }
};

/**
 * Run a command and return its stdout
 *
 * @param {string[]|string} cmdline - command line to execute. If a {string} is passed, it will be splitted into a {string[]}
 * @param {object} [opt] - options
 * @param {boolean} [opt.usePath=true] - if {true}, the file is searched in the PATH environment variable (default = {true})
 * @param {string} [opt.cwd] - set the working directory of the new process
 * @param {number} [opt.uid] - if defined, process uid will be set using setuid
 * @param {number} [opt.gid] - if defined, process gid will be set using setgid
 * @param {object} [opt.env] - define child process environment (if not defined, use the environment of parent process)
 * @param {boolean} [opt.replaceEnv=true] - if {true}, ignore parent environment when setting child environment (default = {true})
 * @param {boolean} [opt.useShell=false] - if {true}, run command using '/bin/sh -c' (default = {false})
 * @param {string} [opt.shell="/bin/sh"] - full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
 * @param {boolean} [opt.newSession=false] - if {true} setsid will be used (ie: child will not receive SIGINT sent to parent) (default = {false})
 * @param {boolean} [opt.passStderr=false] - if {true} stderr will not be intercepted (default = {false}) (ignored if {opt.streamStdout} is {false})
 * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false})
 *                                               Ignored if {opt.passStderr} is {true} or {opt.streamStdout} is {false}
 * @param {boolean} [opt.streamStdout=true] - whether or not streaming should be enabled (default = {true})
 *                                            NB: when set to {false}
 *                                              - stderr redirection will be ignored
 *                                              - {opt.passStderr} will be ignored
 * @param {boolean} [opt.lineBuffered=false] - if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
 * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true})
 * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
 * @param {number} [opt.timeout] - maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
 * @param {number} [opt.timeoutSignal=os.SIGTERM] - signal to use when killing the child after timeout (default = os.SIGTERM, ignored if {opt.timeout} is not defined)
 * @param {number} [opt.stdin] - if defined, sets the stdin handle used by child process (it will be rewind)
 *                                NB: don't share the same handle between multiple instances
 * @param {string} [opt.input] - content which will be used as input (will be ignored if {stdin} is set)
 * @param {boolean} [opt.ignoreError=false] - if {true} promise will resolve to the content of stdout even if process exited with a non zero code (default = {false})
 * @param {number} [opt.bufferSize=512] - size (in bytes) of the buffer used to read from process stdout & stderr streams (default = {512})
 *
 * @returns {Promise<string>} promise which will resolve to the content of stdout in case process exited with zero or {opt.ignoreError} is {true}
 * @throws {Error} content of stderr as the message and following extra properties :
 *                 - {state} (as returned by {run})
 */
const exec = async (cmdline, opt) => {
  const options = Object.assign({}, opt);
  const ignoreError = true === options.ignoreError;
  delete options.ignoreError;
  const p = new Process(cmdline, options);
  await p.run();
  if (!ignoreError) {
    ensureProcessResult(p);
  }
  return p.stdout;
};

class ProcessSync {
  /**
   * Constructor
   *
   * @param {string[]|string} cmdline - command line to execute. If a {string} is passed, it will be splitted into a {string[]}
   * @param {object} [opt] - options
   * @param {boolean} [opt.usePath=true] - if {true}, the file is searched in the PATH environment variable (default = {true})
   * @param {string} [opt.cwd] - set the working directory of the new process
   * @param {number} [opt.uid] - if defined, process uid will be set using setuid
   * @param {number} [opt.gid] - if defined, process gid will be set using setgid
   * @param {object} [opt.env] - define child process environment (if not defined, use the environment of parent process)
   * @param {boolean} [opt.replaceEnv=true] - if {true}, ignore parent environment when setting child environment (default = {true})
   * @param {boolean} [opt.useShell=false] - if {true}, run command using '/bin/sh -c' (default = {false})
   * @param {string} [opt.shell="/bin/sh"] - full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
   * @param {boolean} [opt.passStderr=true] - if {true} stderr will not be intercepted (default = {true})
   * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true} or {opt.passStdout} is {true})
   * @param {boolean} [opt.passStdout=true] - if {true} stdout will not be intercepted (default = {false})
   * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true})
   * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
   * @param {number} [opt.stdin] - if defined, sets the stdin handle used by child process (it will be rewind)
   *                                NB: don't share the same handle between multiple instances
   * @param {string} [opt.input] - content which will be used as input (will be ignored if {stdin} is set)
   * @param {object} [opt.props] - custom properties
   */
  constructor(cmdline, opt) {
    if (undefined === opt) {
      opt = {};
    }

    /*
      command
     */
    /** @private */
    this._cmdline = '';
    /**
     * @private
     * @type {string[] | undefined}
     */
    this._args = [];
    if (Array.isArray(cmdline)) {
      if (0 != cmdline.length) {
        this._cmdline = cmdline.join(' ');
        this._args = [...cmdline];
      }
    }
    // consider it is a string
    else if ('string' == typeof cmdline) {
      this._cmdline = cmdline.trim();
      this._args = parseArgs(this._cmdline);
    }
    if ('' == this._cmdline) {
      throw new TypeError(`Argument 'cmdline' cannot be empty`);
    }

    /*
      state
     */
    /** @private */
    this._run = false;
    /** @private */
    this._exitCode = 0;

    /*
      output
     */
    /** @private */
    this._passStderr = false !== opt.passStderr;
    /** @private */
    this._redirectStderr = !this._passStderr && true === opt.redirectStderr;
    /** @private */
    this._passStdout = true === opt.passStdout;
    /** @private */
    this._output = {
      stdout: '',
      stderr: '',
    };
    // by default trim content
    /** @private */
    this._trim = false !== opt.trim;
    // by default do not skip empty lines
    /** @private */
    this._skipBlankLines = true === opt.skipBlankLines;

    // environment
    let newEnv;
    if (undefined !== opt.env) {
      // initialize with current environment
      if (false === opt.replaceEnv) {
        newEnv = std.getenviron();
      } else {
        newEnv = {};
      }
      // update with the environment passed in opt
      for (const [key, value] of Object.entries(opt.env)) {
        newEnv[key] = value;
      }
    }

    /*
      options
     */
    // qjs options
    /**
     * @private
     * @type {import('./os.js').ExecOptions}
     */
    this._qjsOpt = {
      block: true,
      // by default use PATH
      usePath: false !== opt.usePath,
      cwd: opt.cwd,
      uid: opt.uid,
      gid: opt.gid,
      env: newEnv,
    };
    /** @private */
    this._input = undefined;
    if (undefined !== opt.stdin) {
      this._qjsOpt.stdin = opt.stdin;
    } else if (undefined !== opt.input && 'string' == typeof opt.input) {
      this._input = opt.input;
    }
    // by default don't use shell
    /** @private */
    this._useShell = { flag: false, shell: DEFAULT_SHELL };
    if (true === opt.useShell) {
      this._useShell.flag = true;
      if (undefined !== opt.shell) {
        this._useShell.shell = opt.shell;
      }
    }

    /** @private */
    this._props = opt.props;
    if (undefined === this._props || 'object' != typeof this._props) {
      this._props = {};
    }
  }

  /**
   * Convert signal value to name
   *
   * @param {number} signal - signal number
   *
   * @returns {string|undefined}
   */
  static getSignalName(signal) {
    return getSignalName(signal);
  }

  /**
   * Retrieve full cmd line
   *
   * @returns {string}
   */
  get cmdline() {
    return this._cmdline;
  }

  /**
   * Retrieve full stdout content
   *
   * @returns {string}
   */
  get stdout() {
    return this._output.stdout;
  }

  /**
   * Retrieve full stderr content
   *
   * @returns {string}
   */
  get stderr() {
    return this._output.stderr;
  }

  /**
   * Retrieve process exit code
   *
   * @returns {number}
   */
  get exitCode() {
    return this._exitCode;
  }

  /**
   * Indicate whether or not execution succeeded
   *
   * @returns {boolean} {true} if process was started and execution succeeded, {false} otherwise
   */
  get success() {
    if (!this._run) {
      return false;
    }
    return 0 == this._exitCode;
  }

  /**
   * Retrieve custom properties passed in constructor
   *
   * @returns {object}
   */
  get props() {
    return this._props;
  }

  /**
   * Execute the command line
   *
   * @returns {boolean}
   */
  run() {
    this._reset();

    let args;
    // use shell
    if (this._useShell.flag) {
      // use cmdline as a single argument since we're using shell
      args = [this._useShell.shell, '-c', this._cmdline];
    } else {
      args = [...(this._args || [])];
    }

    /*
      create stdout file
     */
    let stdoutFile = undefined;
    if (!this._passStdout) {
      stdoutFile = std.tmpfile();
      if (null === stdoutFile) {
        // @ts-ignore
        throw new InternalError('Could not create temporary stdout file');
      }
    }

    /*
      create stderr file
     */
    let stderrFile = undefined;
    if (!this._passStderr && !this._redirectStderr) {
      stderrFile = std.tmpfile();
      if (null === stderrFile) {
        // close stdout file
        if (undefined !== stdoutFile) {
          stdoutFile.close();
        }
        // @ts-ignore
        throw new InternalError(`Could not create temporary stderr file`);
      }
    }

    /*
      create input
     */
    let stdinFile = undefined;
    let stdinFd = undefined;
    if (undefined !== this._input) {
      stdinFile = std.tmpfile();
      if (null === stdinFile) {
        if (undefined !== stdoutFile) {
          stdoutFile.close();
        }
        if (undefined !== stderrFile) {
          stderrFile.close();
        }
        // @ts-ignore
        throw new InternalError('Could not create temporary input file');
      }
      stdinFile.puts(this._input);
      stdinFile.flush();
      stdinFd = stdinFile.fileno();
    }
    if (undefined !== stdinFd) {
      // rewind stdin file descriptor
      os.seek(stdinFd, 0, std.SEEK_SET);
    }

    /*
      create process
     */
    const qjsOpt = Object.assign({}, this._qjsOpt);
    if (undefined !== stdinFd) {
      qjsOpt.stdin = stdinFd;
    }
    if (undefined !== stdoutFile) {
      qjsOpt.stdout = stdoutFile.fileno();
    }

    if (!this._passStderr) {
      if (this._redirectStderr) {
        qjsOpt.stderr = qjsOpt.stdout;
      }
      if (undefined !== stderrFile) {
        qjsOpt.stderr = stderrFile.fileno();
      }
    }
    this._exitCode = os.exec(args, qjsOpt);
    this._run = true;

    // read stdout
    if (undefined !== stdoutFile) {
      stdoutFile.flush();
      stdoutFile.seek(0, std.SEEK_SET);
      this._output.stdout = stdoutFile.readAsString();
      stdoutFile.close();
    }
    if ('' != this._output.stdout) {
      // remove empty lines
      if (this._skipBlankLines) {
        this._output.stdout = this._output.stdout.replace(/^\s*\n/gm, '');
      }
      // trim
      if (this._trim) {
        this._output.stdout = this._output.stdout.trim();
      }
    }

    // read stderr
    if (undefined !== stderrFile) {
      stderrFile.flush();
      os.seek(stderrFile.fileno(), 0, std.SEEK_SET);
      this._output.stderr = stderrFile.readAsString();
      stderrFile.close();
      if ('' != this._output.stderr) {
        // remove empty lines
        if (this._skipBlankLines) {
          this._output.stderr = this._output.stderr.replace(/^\s*\n/gm, '');
        }
        // trim
        if (this._trim) {
          this._output.stderr = this._output.stderr.trim();
        }
      }
    }

    // command was not found => check if we need to generate a custom message
    if (127 == this._exitCode) {
      const content = 'Command not found';
      // check stderr
      if (undefined !== stderrFile) {
        // we didn't receive any content on stderr => use custom message
        if ('' == this._output.stderr) {
          this._output.stderr = content;
        }
      }
    }

    return 0 === this._exitCode;
  }

  /**
   * Reset internal state. Called at the beginning of {run} method
   *
   * @private
   */
  _reset() {
    this._exitCode = 0;
    this._run = false;
    this._output = {
      stdout: '',
      stderr: '',
    };
  }
}

/**
 * Run a command synchronously and return its stdout
 *
 * @param {string[]|string} cmdline - command line to execute. If a {string} is passed, it will be splitted into a {string[]}
 * @param {object} [opt] - options
 * @param {boolean} [opt.usePath=true] - if {true}, the file is searched in the PATH environment variable (default = {true})
 * @param {string} [opt.cwd] - set the working directory of the new process
 * @param {number} [opt.uid] - if defined, process uid will be set using setuid
 * @param {number} [opt.gid] - if defined, process gid will be set using setgid
 * @param {object} [opt.env] - define child process environment (if not defined, use the environment of parent process)
 * @param {boolean} [opt.replaceEnv=true] - if {true}, ignore parent environment when setting child environment (default = {true})
 * @param {boolean} [opt.useShell=false] - if {true}, run command using '/bin/sh -c' (default = {false})
 * @param {string} [opt.shell="/bin/sh"] - full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
 * @param {boolean} [opt.passStderr=true] - if {true} stderr will not be intercepted (default = {true})
 * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true} or {opt.passStdout} is {true})
 * @param {boolean} [opt.passStdout=true] - if {true} stdout will not be intercepted (default = {false})
 * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true})
 * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
 * @param {number} [opt.stdin] - if defined, sets the stdin handle used by child process (it will be rewind)
 *                                NB: don't share the same handle between multiple instances
 * @param {string} [opt.input] - content which will be used as input (will be ignored if {stdin} is set)
 * @param {boolean} [opt.ignoreError=false] - if {true} promise will resolve to the content of stdout even if process exited with a non zero code (default = {false})
 *
 * @returns {string} content of stdout in case process exited with zero or {opt.ignoreError} is {true}
 *
 * @throws {Error} content of stderr as the message and following extra properties :
 *                 - {exitCode} (exit code of the process)
 */
const execSync = (cmdline, opt) => {
  const options = Object.assign({}, opt);
  const ignoreError = true === options.ignoreError;
  delete options.ignoreError;
  const p = new ProcessSync(cmdline, options);
  p.run();
  if (!ignoreError) {
    ensureProcessResult(p);
  }
  return p.stdout;
};

/**
 * Wait asynchronously until a given process is terminated
 * NB: method will resolve if EPERM is returned by os
 *
 * @param {number} pid - process pid
 * @param {number} [pollDelay=250] - delay in ms between polling
 *
 * @returns {Promise<void>} promise which will resolve once the process is gone
 */
const waitpid = async (pid, pollDelay = 250) => {
  for (;;) {
    if (0 != os.kill(pid, 0)) {
      return;
    }
    await wait(pollDelay);
  }
};

/**
 * Ensures a process executed successfully (ie: exit code == 0) and throws an error if not
 *
 * @param {Process|ProcessSync} process - process to check result for
 *
 * @throws {Error}
 */
const ensureProcessResult = (process) => {
  if (process instanceof Process) {
    const state = process.state;
    if (0 !== state.exitCode) {
      let message = process.stderr;
      if ('' == message && 127 == state.exitCode) {
        message = 'Command not found';
      }
      /** @type {any} */
      const err = new Error(message);
      err.state = state;
      throw err;
    }
  } else if (process instanceof ProcessSync) {
    if (0 !== process.exitCode) {
      let message = process.stderr;
      if ('' == message && 127 == process.exitCode) {
        message = 'Command not found';
      }
      /** @type {any} */
      const err = new Error(message);
      err.exitCode = process.exitCode;
      throw err;
    }
  }
};

export default exec;

export {
  Process,
  exec,
  waitpid,
  kill,
  getChildPids,
  ProcessSync,
  execSync,
  ensureProcessResult,
};
