/** @format */
// @ts-check
'use strict;';

/*
  Execute external processes asynchronously
 */

// @ts-ignore
import * as os from 'os';
// @ts-ignore
import * as std from 'std';

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
 * @property {boolean} [didTimeout] - whether or not process was killed after timeout
 * @property {string} [signalName] - signal name (only defined if process was terminated using a signal)
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
    case 1:
      return 'SIGHUP';
    case 2:
      return 'SIGINT';
    case 3:
      return 'SIGQUIT';
    case 6:
      return 'SIGABRT';
    case 9:
      return 'SIGKILL';
    case 15:
      return 'SIGTERM';
  }
};

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
   * @param {boolean} [opt.passStderr=false] - if {true} stderr will not be intercepted (default = {false}) (ignored if {opt.stdout} is set)
   * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true})
   * @param {boolean} [opt.lineBuffered=false] - if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
   * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
   * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
   * @param {number} [opt.timeout] - maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
   * @param {number} [opt.timeoutSignal=os.SIGTERM] - signal to use when killing the child after timeout (default = SIGTERM, ignored if {opt.timeout} is not defined)
   * @param {number} [opt.stdin] - if defined, sets the stdin handle used by child process (it will be rewind)
   *                                NB: don't share the same handle between multiple instances
   * @param {string} [opt.input] - content which will be used as input (will be ignored if {stdin} is set)
   * @param {number} [opt.stdout] - if defined, sets the stdout handle used by child process (it will be rewind)
   *                                NB: - don't share the same handle between multiple instances
   *                                    - stdout event handler will be ignored
   *                                    - stderr redirection will be ignored
   *                                    - {passStderr} will be ignored
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
    this._cmdline = '';
    /** @type {string[] | undefined} */
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
    this._didStart = false;
    this._didStop = false;
    this._promise = undefined;
    this._state = {
      pid: 0,
      exitCode: 0,
      didTimeout: false,
    };
    // whether or not process was paused
    this._paused = false;

    /*
      callbacks
     */
    /** @type {Record<string, Function|undefined>} */
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
    this._passStderr = true === opt.passStderr;
    this._redirectStderr = !this._passStderr && true === opt.redirectStderr;
    this._output = {
      stdout: '',
      stderr: '',
    };
    // by default don't buffer lines
    this._lineBuffered = true === opt.lineBuffered;
    // by default trim buffered content
    this._trim = false !== opt.trim;
    // by default do not skip empty lines
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
    this._qjsOpt = {
      block: false,
      // by default use PATH
      usePath: false !== opt.usePath,
      cwd: opt.cwd,
      uid: opt.uid,
      gid: opt.gid,
      env: newEnv,
    };
    this._input = undefined;
    if (undefined !== opt.stdin) {
      this._qjsOpt.stdin = opt.stdin;
    } else if (undefined !== opt.input && 'string' == typeof opt.input) {
      this._input = opt.input;
    }
    if (undefined !== opt.stdout) {
      this._qjsOpt.stdout = opt.stdout;
      /*
        If stdout was set, we need to rely on stderr
        to detect the end of the child process
       */
      // disable stderr redirection
      this._redirectStderr = false;
      // disable passStderr
      this._passStderr = false;
    }
    // by default don't use shell
    this._useShell = { flag: false, shell: DEFAULT_SHELL };
    if (true === opt.useShell) {
      this._useShell.flag = true;
      if (undefined !== opt.shell) {
        this._useShell.shell = opt.shell;
      }
    }
    // by default don't use a new session
    this._newSession = true === opt.newSession;
    if (true === opt.newSession) {
      this._newSession = true;
    }
    // by default don't use timeout
    this._timeout = {
      enabled: false,
      delay: 0,
      // @ts-ignore
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

    this._props = opt.props;
    if (undefined === this._props || 'object' != typeof this._props) {
      this._props = {};
    }

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
   * @returns {object}
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
   * @param {string} eventType - (stdout|stderr|pause|resume|exit)
   * @param {Function|undefined} cb - (use {undefined} to disable handler)
   */
  setEventListener(eventType, cb) {
    switch (eventType) {
      case 'stdout':
        this._cb[eventType] = cb;
        return;
      case 'stderr':
        this._cb[eventType] = cb;
        return;
      case 'exit':
        this._cb[eventType] = cb;
        return;
      case 'pause':
        this._cb[eventType] = cb;
        return;
      case 'resume':
        this._cb[eventType] = cb;
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
      let timer;

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

      let stdoutPipe = undefined;
      let stderrPipe = undefined;
      let stdinPipe = undefined;

      /**
       * Executed after :
       * - both stdout & stderr are closed if no stdout handle was passed to constructor
       * - stderr is closed if a stdout handle was passed to constructor
       */
      const finalize = () => {
        // remove timer
        if (undefined !== timer) {
          // @ts-ignore
          os.clearTimeout(timer);
          timer = undefined;
        }
        // @ts-ignore
        const [ret, status] = os.waitpid(this._state.pid);

        /*
          close pipes
         */
        if (undefined !== stdoutPipe) {
          // @ts-ignore
          os.close(stdoutPipe[0]);
        }
        if (undefined !== stderrPipe) {
          // @ts-ignore
          os.close(stderrPipe[0]);
        }
        if (undefined !== stdinPipe) {
          // @ts-ignore
          os.close(stdinPipe[1]);
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
          // @ts-ignore
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
        // @ts-ignore
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
        // @ts-ignore
        os.setReadHandler(stdoutPipe[0], () => {
          if (0 === this._state.pid) {
            return;
          }

          const timestamp = Date.now();
          // @ts-ignore
          const len = os.read(
            stdoutPipe[0],
            stdoutBuffer.buffer,
            0,
            stdoutBuffer.length
          );

          // end of stream
          if (0 == len) {
            // @ts-ignore
            os.setReadHandler(stdoutPipe[0], null);
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
                  // @ts-ignore
                  this._cb.stdout({
                    pid: this._state.pid,
                    data: str,
                    timestamp: stdoutIncompleteLine.timestamp,
                  });
                  return;
                }
              }
              // @ts-ignore
              this._cb.stdout({
                pid: this._state.pid,
                data: str,
                timestamp: timestamp,
              });
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
      let stderrBuffer;
      if (!this._redirectStderr && !this._passStderr) {
        // @ts-ignore
        stderrPipe = os.pipe();
        if (null === stderrPipe) {
          // close stdout pipe (only if no stdout handle was passed to constructor)
          if (undefined !== this._qjsOpt.stdout) {
            // @ts-ignore
            os.setReadHandler(stdoutPipe[0], null);
            // @ts-ignore
            os.close(stdoutPipe[0]);
            // @ts-ignore
            os.close(stdoutPipe[1]);
          }
          // @ts-ignore
          throw new InternalError(`Could not create stderr pipe`);
        }
        stderrBuffer = new Uint8Array(this._bufferSize);
        let stderrIncompleteLine = {
          data: '',
          timestamp: Date.now(),
        };
        // @ts-ignore
        os.setReadHandler(stderrPipe[0], () => {
          const timestamp = Date.now();
          // @ts-ignore
          const len = os.read(
            stderrPipe[0],
            stderrBuffer.buffer,
            0,
            stderrBuffer.length
          );

          // end of stream
          if (0 == len) {
            // @ts-ignore
            os.setReadHandler(stderrPipe[0], null);
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
          const content = bytesArrayToStr(stderrBuffer, { from: 0, to: len });
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
                  // @ts-ignore
                  this._cb.stderr({
                    pid: this._state.pid,
                    data: str,
                    timestamp: stderrIncompleteLine.timestamp,
                  });
                  return;
                }
              }
              // @ts-ignore
              this._cb.stderr({
                pid: this._state.pid,
                data: str,
                timestamp: stderrIncompleteLine.timestamp,
              });
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
        // @ts-ignore
        stdinPipe = os.pipe();
        if (null === stdinPipe) {
          // close stdout pipe (only if no stdout handle was passed to constructor)
          if (undefined !== this._qjsOpt.stdout) {
            // @ts-ignore
            os.setReadHandler(stdoutPipe[0], null);
            // @ts-ignore
            os.close(stdoutPipe[0]);
            // @ts-ignore
            os.close(stdoutPipe[1]);
          }
          if (undefined !== stderrPipe) {
            // @ts-ignore
            os.close(stderrPipe[0]);
            // @ts-ignore
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
      if (undefined !== stdinPipe) {
        qjsOpt.stdin = stdinPipe[0];
      }
      if (undefined !== this._qjsOpt.stdout) {
        // rewind stdout file descriptor
        // @ts-ignore
        os.seek(this._qjsOpt.stdout, 0, std.SEEK_SET);
      } else {
        qjsOpt.stdout = stdoutPipe[1];
      }
      if (!this._passStderr) {
        qjsOpt.stderr = qjsOpt.stdout;
      }
      if (undefined !== stderrPipe) {
        qjsOpt.stderr = stderrPipe[1];
      }
      // rewind stdin file descriptor
      if (undefined !== this._qjsOpt.stdin) {
        // @ts-ignore
        os.seek(this._qjsOpt.stdin, 0, std.SEEK_SET);
      }
      // @ts-ignore
      this._state.pid = os.exec(args, qjsOpt);

      /*
        close the write ends of the pipes as we don't need them anymore
       */
      // only close pipe if no stdout handle was passed to constructor
      if (undefined === this._qjsOpt.stdout) {
        // @ts-ignore
        os.close(stdoutPipe[1]);
      }
      if (undefined !== stderrPipe) {
        // @ts-ignore
        os.close(stderrPipe[1]);
      }

      /*
        send input
       */
      if (undefined !== stdinPipe) {
        // @ts-ignore
        const bytesArray = strToBytesArray(this._input);
        // @ts-ignore
        os.write(stdinPipe[1], bytesArray.buffer, 0, bytesArray.length);
        // @ts-ignore
        os.close(stdinPipe[1]);
      }

      /*
        timeout
       */
      if (this._timeout.enabled) {
        // @ts-ignore
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
    if (undefined === this._state.pid || this._didStop || this._paused) {
      return;
    }
    // @ts-ignore
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
    if (undefined === this._state.pid || this._didStop || !this._paused) {
      return;
    }
    // @ts-ignore
    os.kill(this._state.pid, os.SIGCONT);
    this._paused = false;
    if (undefined !== this._cb.resume) {
      this._cb.resume({
        pid: this._state.pid,
      });
    }
  }

  /**
   * Kill the child process
   *
   * @param {number} [signal=os.SIGTERM] - signal number to use (default = SIGTERM)
   */
  // @ts-ignore
  kill(signal = os.SIGTERM) {
    // do nothing if process is not running
    if (undefined === this._state.pid || this._didStop) {
      return;
    }
    // resume process if it is paused
    if (this._paused) {
      // @ts-ignore
      os.kill(this._state.pid, os.SIGCONT);
    }
    // @ts-ignore
    os.kill(this._state.pid, signal);
  }

  /**
   * Reset internal state. Called at the beginning of {run} method
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
 * @param {boolean} [opt.passStderr=false] - if {true} stderr will not be intercepted (default = {false})
 * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true})
 * @param {boolean} [opt.lineBuffered=false] - if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
 * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true})
 * @param {boolean} [opt.skipBlankLines=false] - if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
 * @param {number} [opt.timeout] - maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
 * @param {number} [opt.timeoutSignal=os.SIGTERM] - signal to use when killing the child after timeout (default = SIGTERM, ignored if {opt.timeout} is not defined)
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
  // supporting {opt.stdout} does not make sense here
  // @ts-ignore
  delete options.stdout;
  const p = new Process(cmdline, options);
  const state = await p.run();
  if (0 == state.exitCode) {
    return p.stdout;
  }
  if (ignoreError) {
    return p.stdout;
  }
  let message = p.stderr;
  if ('' == message && 127 == state.exitCode) {
    message = 'Command not found';
  }
  /** @type {any} */
  const err = new Error(message);
  err.state = state;
  throw err;
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
   * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true})
   * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
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
    this._cmdline = '';
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
    this._run = false;
    this._exitCode = 0;

    /*
      output
     */
    this._passStderr = false !== opt.passStderr;
    this._redirectStderr = !this._passStderr && true === opt.redirectStderr;
    this._output = {
      stdout: '',
      stderr: '',
    };
    // by default trim content
    this._trim = false !== opt.trim;
    // by default do not skip empty lines
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
    this._qjsOpt = {
      block: true,
      // by default use PATH
      usePath: false !== opt.usePath,
      cwd: opt.cwd,
      uid: opt.uid,
      gid: opt.gid,
      env: newEnv,
    };
    this._input = undefined;
    if (undefined !== opt.stdin) {
      this._qjsOpt.stdin = opt.stdin;
    } else if (undefined !== opt.input && 'string' == typeof opt.input) {
      this._input = opt.input;
    }
    // by default don't use shell
    this._useShell = { flag: false, shell: DEFAULT_SHELL };
    if (true === opt.useShell) {
      this._useShell.flag = true;
      if (undefined !== opt.shell) {
        this._useShell.shell = opt.shell;
      }
    }

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
    const stdoutFile = std.tmpfile();
    if (null === stdoutFile) {
      // @ts-ignore
      throw new InternalError('Could not create temporary stdout file');
    }

    /*
      create stderr file
     */
    let stderrFile = undefined;
    if (!this._passStderr && !this._redirectStderr) {
      stderrFile = std.tmpfile();
      if (null === stderrFile) {
        // close stdout file
        stdoutFile.close();
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
        stdoutFile.close();
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
      // @ts-ignore
      os.seek(stdinFd, 0, std.SEEK_SET);
    }

    /*
      create process
     */
    const qjsOpt = Object.assign({}, this._qjsOpt);
    if (undefined !== stdinFd) {
      qjsOpt.stdin = stdinFd;
    }
    qjsOpt.stdout = stdoutFile.fileno();

    if (!this._passStderr) {
      qjsOpt.stderr = qjsOpt.stdout;
      if (undefined !== stderrFile) {
        qjsOpt.stderr = stderrFile.fileno();
      }
    }
    // @ts-ignore
    this._exitCode = os.exec(args, qjsOpt);
    this._run = true;

    // read stdout
    stdoutFile.flush();
    stdoutFile.seek(0, std.SEEK_SET);
    this._output.stdout = stdoutFile.readAsString();
    stdoutFile.close();
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
      // @ts-ignore
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
 * @param {boolean} [opt.redirectStderr=false] - if {true} stderr will be redirected to stdout (default = {false}) (ignored if {opt.passStderr} is {true})
 * @param {boolean} [opt.trim=true] - if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
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
  if (p.run()) {
    return p.stdout;
  }
  if (ignoreError) {
    return p.stdout;
  }
  let message = p.stderr;
  if ('' == message && 127 == p.exitCode) {
    message = 'Command not found';
  }
  /** @type {any} */
  const err = new Error(message);
  err.exitCode = p.exitCode;
  throw err;
};

/**
 * Wait asynchronously until a given process is terminated
 * NB: method will resolve if EPERM is returned by os
 *
 * @param {number} pid - process pid
 * @param {number} [pollDelay=250] - delay in ms between polling
 *
 * @returns {Promise} promise which will resolve once the process is gone
 */
const waitpid = async (pid, pollDelay = 250) => {
  for (;;) {
    // @ts-ignore
    if (0 != os.kill(pid, 0)) {
      return;
    }
    await wait(pollDelay);
  }
};

export default exec;

export { Process, exec, waitpid, ProcessSync, execSync };
