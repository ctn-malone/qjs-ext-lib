"use strict;"

/*
    Execute external processes asynchronously
 */

import * as os from 'os';
import * as std from 'std';

import { bytesArrayToStr, getLines } from './strings.js';
import { wait } from './timers.js';

/**
 * Parse a command line into an array of arguments
 *
 * @param {string} command line
 *
 * @return {string[} arguments
 */
const parseArgs = (command) => {
    // NB: regexp will fail in case an orphan quote or double quote exists
    const args = command.match(/[^"' \t]+|["'](?:\\["']|[^"'])*['"]/g);
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
}

/**
 * Convert signal value to name
 *
 * @param {string} signal
 *
 * @return {string}
 */
const getSignalName = (signal) => {
    // use values defined in 'include/bits/signal.h' (musl lib)
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
}

const DEFAULT_SHELL = '/bin/sh';
const SETSID_BINARY = '/usr/bin/setsid';
const DEFAULT_BUFFER_SIZE = 512;

class Process {

    /**
     * Constructor
     *
     * @param {string[]|string} cmdline command line to execute. If a {string} is passed, it will be splitted into a {string[]}
     * @param {object} opt options
     * @param {boolean} opt.usePath if {true}, the file is searched in the PATH environment variable (default = {true})
     * @param {string} opt.cwd set the working directory of the new process
     * @param {integer} opt.uid if defined, process uid will be set using setuid
     * @param {integer} opt.gid if defined, process gid will be set using setgid
     * @param {object} opt.env define child process environment (if not defined, use the environment of parent process)
     * @param {boolean} opt.replaceEnv if {true}, ignore parent environment when setting child environment (default = {true})
     * @param {boolean} opt.useShell if {true}, run command using '/bin/sh -c' (default = {false})
     * @param {string} opt.shell full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
     * @param {boolean} opt.newSession if {true} setsid will be used (ie: child will not receive SIGINT sent to parent) (default = {false})
     * @param {boolean} opt.redirectStderr if {true} stderr will be redirected to stdout (default = {false})
     * @param {boolean} opt.lineBuffered if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
     * @param {boolean} opt.trim if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
     * @param {boolean} opt.skipBlankLines if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
     * @param {integer} opt.timeout maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
     * @param {integer} opt.timeoutSignal signal to use when killing the child after timeout (default = SIGTERM, ignored if {opt.timeout} is not defined)
     * @param {integer} opt.stdin if defined, sets the stdin handle used by child process (it will be rewind)
     *                            NB: don't share the same handle between multiple instances
     * @param {integer} opt.stdout if defined, sets the stdout handle used by child process (it will be rewind)
     *                            NB: - don't share the same handle between multiple instances
     *                                - stdout event handler will be ignored
     *                                - stderr redirection will be ignored
     * @param {integer} opt.bufferSize size (in bytes) of the buffer used to read from process stdout & stderr streams (default = {512})
     * @param {object} opt.props custom properties
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
            pid & state
         */
        this._didStart = false;
        this._didStop = false;
        this._promise = undefined;
        this._state = {
            pid:0,
            exitCode:0,
            didTimeout:false
        };
        // whether or not process was paused
        this._paused = false;

        /*
            callbacks
         */
        this._cb = {
            stdout:undefined,
            stderr:undefined,
            exit:undefined,
            pause:undefined,
            resume:undefined
        };

        /*
            output
         */
        this._redirectStderr = (true === opt.redirectStderr);
        this._output = {
            stdout:'',
            stderr:''
        };
        // by default don't buffer lines
        this._lineBuffered = (true === opt.lineBuffered);
        // by default trim buffered content
        this._trim = (false !== opt.trim);
        // by default do not skip empty lines
        this._skipBlankLines = (true === opt.skipBlankLines);

        // environment
        let newEnv;
        if (undefined !== opt.env) {
            // initialize with current environment
            if (false === opt.replaceEnv) {
                newEnv = std.getenviron();
            }
            else {
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
            block:false,
            // by default use PATH
            usePath:(false !== opt.usePath),
            cwd:opt.cwd,
            uid:opt.uid,
            gid:opt.gid,
            env:newEnv
        };
        if (undefined !== opt.stdin) {
            this._qjsOpt.stdin = opt.stdin;
        }
        if (undefined !== opt.stdout) {
            this._qjsOpt.stdout = opt.stdout;
            // disable stderr redirection
            this._redirectStderr = false;
        }
        // by default don't use shell
        this._useShell = {flag:false, shell:DEFAULT_SHELL};
        if (true === opt.useShell) {
            this._useShell.flag = true;
            if (undefined !== opt.shell) {
                this._useShell.shell = opt.shell;
            }
        }
        // by default don't use a new session
        this._newSession = (true === opt.newSession);
        if (true === opt.newSession) {
            this._newSession = true;
        }
        // by default don't use timeout
        this._timeout = {
            enabled:false,
            delay:0,
            signal:os.SIGTERM
        };
        if (undefined !== opt.timeout) {
            const value = parseInt(opt.timeout);
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
            const value = parseInt(opt.bufferSize);
            if (!isNaN(value) && value > 0) {
                this._bufferSize = value;
            }
        }
    }

    /**
     * Convert signal value to name
     *
     * @param {string} signal
     *
     * @return {string}
     */
    static getSignalName(signal) {
        return getSignalName(signal);
    }

    /**
     * Retrieve full cmd line
     *
     * @return {string}
     */
    get cmdline() {
        return this._cmdline;
    }

    /**
     * Retrieve full stdout content
     * Will always be empty if a 'stdout' listener was defined
     *
     * @return {integer}
     */
    get stdout() {
        return this._output.stdout;
    }

    /**
     * Retrieve full stderr content
     * Will always be empty if a 'stderr' listener was defined
     *
     * @return {integer}
     */
    get stderr() {
        return this._output.stderr;
    }

    /**
     * Indicate whether or not process is running
     *
     * @return {boolean}
     */
    get running() {
        return this._didStart && !this._didStop;
    }

    /**
     * Indicate whether or not process is paused
     *
     * @return {boolean}
     */
    get paused() {
        return this._paused;
    }

    /**
     * Retrieve process state (pid, exitCode ...)
     *
     * @return {object}
     */
    get state() {
        return Object.assign({}, this._state);
    }

    /**
     * Indicate whether or not execution succeeded
     *
     * @return {boolean} {true} if process was started and execution succeeded, {false} otherwise
     */
    get success() {
        if (!this._didStart) {
            return false;
        }
        return (0 == this._state.exitCode);
    }

    /**
     * Retrieve process pid
     *
     * @return {integer}
     */
    get pid() {
        return this._state.pid;
    }

    /**
     * Retrieve custom properties passed in constructor
     * 
     * @return {object}
     */
    get props() {
        return this._props;
    }

    /**
     * Define event handler
     * Any previously defined handler will be replaced
     *
     * @param {string} eventType (stdout|stderr|pause|resume|exit)
     * @param {function} cb (use {undefined} to disable handler)
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
     * @return {Promise} promise which will resolve to an object (see example below)
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
            }
            else {
                args = [...this._args];
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
            if (this._redirectStderr) {
                endOfStderr = true;
            }

            let stdoutPipe = undefined;
            let stderrPipe = undefined;

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
                if (undefined !== stdoutPipe) {
                    os.close(stdoutPipe[0]);
                }
                if (undefined !== stderrPipe) {
                    os.close(stderrPipe[0]);
                }

                /*
                    below code is borrowed from quickjs
                 */
                // child terminated normally
                if (!((status) & 0x7f)) {
                    this._state.exitCode = (((status) & 0xff00) >> 8);
                }
                // child was terminated by a signal
                else {
                    const signal = ((status) & 0x7f);
                    this._state.exitCode = -signal;
                    this._state.signal = getSignalName(signal);
                }
                // command was not found => check if we need to generate a custom message
                if (127 == this._state.exitCode) {
                    const content = 'Command not found';
                    // check stderr
                    if (!this._redirectStderr) {
                        // we didn't receive any content on stderr => use custom message
                        if (!gotStderrContent) {
                            if (undefined !== this._cb.stderr) {
                                this._cb.stderr({
                                    pid:this._state.pid,
                                    data:content,
                                    timestamp:Date.now()
                                });
                            }
                            else {
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
                                    pid:this._state.pid,
                                    data:content,
                                    timestamp:Date.now()
                                });
                            }
                            else {
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
            }

            /*
                process stdout (only if no stdout handle was passed to constructor)
             */
            if (undefined === this._qjsOpt.stdout) {
                stdoutPipe = os.pipe();
                if (null === stdoutPipe) {
                    throw new InternalError(`Could not create stdout pipe`);
                }
                const stdoutBuffer = new Uint8Array(this._bufferSize);
                let stdoutIncompleteLine = {
                    data:'',
                    timestamp:Date.now()
                };
                os.setReadHandler(stdoutPipe[0], () => {
                    if (0 === this._state.pid) {
                        return;
                    }
                    
                    const timestamp = Date.now();
                    const len = os.read(stdoutPipe[0], stdoutBuffer.buffer, 0, stdoutBuffer.length);
                    
                    // end of stream
                    if (0 == len) {
                        os.setReadHandler(stdoutPipe[0], null);
                        endOfStdout = true;
                        // process incomplete line if needed
                        if (undefined !== this._cb.stdout) {
                            if (this._lineBuffered && '' != stdoutIncompleteLine.data) {
                                this._cb.stdout({
                                    pid:this._state.pid,
                                    data:stdoutIncompleteLine.data,
                                    timestamp:stdoutIncompleteLine.timestamp
                                });
                            }
                        }
                        // update buffered content
                        else {
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
                        if (endOfStderr) {
                            finalize();
                        }
                        return;
                    }

                    // process data
                    const content = bytesArrayToStr(stdoutBuffer, {from:0, to:len});
                    gotStdoutContent = true;

                    // call callbacks
                    if (undefined !== this._cb.stdout) {
                        if (!this._lineBuffered) {
                            this._cb.stdout({
                                pid:this._state.pid,
                                data:content,
                                timestamp:timestamp
                            });
                            return;
                        }
                        const result = getLines(content, stdoutIncompleteLine.data, this._skipBlankLines);
                        result.lines.forEach((str, i) => {
                            /*
                                check first line in case we're sending a previously
                                incomplete line, to set correct timestamp
                            */
                            if (0 == i) {
                                if ('' != stdoutIncompleteLine.data) {
                                    this._cb.stdout({
                                        pid:this._state.pid,
                                        data:str,
                                        timestamp:stdoutIncompleteLine.timestamp
                                    });
                                    return;
                                }
                            }
                            this._cb.stdout({
                                pid:this._state.pid,
                                data:str,
                                timestamp:timestamp
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
            if (!this._redirectStderr) {
                stderrPipe = os.pipe();
                if (null === stderrPipe) {
                    // close stdout pipe (only if no stdout handle was passed to constructor)
                    if (undefined !== this._qjsOpt.stdout) {
                        os.setReadHandler(stdoutPipe[0], null);
                        os.close(stdoutPipe[0]);
                        os.close(stdoutPipe[1]);
                    }
                    throw new InternalError(`Could not create stderr pipe`);
                }
                stderrBuffer = new Uint8Array(this._bufferSize);
                let stderrIncompleteLine = {
                    data:'',
                    timestamp:Date.now()
                };
                os.setReadHandler(stderrPipe[0], () => {
                    const timestamp = Date.now();
                    const len = os.read(stderrPipe[0], stderrBuffer.buffer, 0, stderrBuffer.length);
                    
                    // end of stream
                    if (0 == len) {
                        os.setReadHandler(stderrPipe[0], null);
                        endOfStderr = true;
                        // process incomplete line if needed
                        if (undefined !== this._cb.stderr) {
                            if (this._lineBuffered && '' != stderrIncompleteLine.data) {
                                this._cb.stderr({
                                    pid:this._state.pid,
                                    data:stderrIncompleteLine.data,
                                    timestamp:stderrIncompleteLine.timestamp
                                });
                            }
                        }
                        // update buffered content
                        else {
                            if ('' != this._output.stderr) {
                                // remove empty lines
                                if (this._skipBlankLines) {
                                    this._output.stderr = this._output.stderr.replace(/^\s*\n/gm, '');
                                }
                                // trim buffered content
                                if (this._trim) {
                                    this._output.stderr = this._output.stderr.trim();
                                }
                            }
                        }
                        if (endOfStdout || (undefined !== this._qjsOpt.stdout)) {
                            finalize();
                        }
                        return;
                    }
                    
                    // process data
                    const content = bytesArrayToStr(stderrBuffer, {from:0, to:len});
                    gotStderrContent = true;
                    
                    // call callbacks
                    if (undefined !== this._cb.stderr) {
                        if (!this._lineBuffered) {
                            this._cb.stderr({
                                pid:this._state.pid,
                                data:content,
                                timestamp:timestamp
                            });
                            return;
                        }
                        const result = getLines(content, stderrIncompleteLine.data, this._skipBlankLines);
                        result.lines.forEach((str, i) => {
                            /*
                                check first line in case we're sending a previously
                                incomplete line, to set correct timestamp
                            */
                            if (0 == i) {
                                if ('' != stderrIncompleteLine.data) {
                                    this._cb.stderr({
                                        pid:this._state.pid,
                                        data:str,
                                        timestamp:stderrIncompleteLine.timestamp
                                    });
                                    return;
                                }
                            }
                            this._cb.stderr({
                                pid:this._state.pid,
                                data:str,
                                timestamp:stderrIncompleteLine.timestamp
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
                create process
             */
            const qjsOpt = Object.assign({}, this._qjsOpt);
            if (undefined !== this._qjsOpt.stdout) {
                // rewind stdout file descriptor
                os.seek(this._qjsOpt.stdout, 0, std.SEEK_SET);
            }
            else {
                qjsOpt.stdout = stdoutPipe[1];
            }
            qjsOpt.stderr = qjsOpt.stdout;
            if (undefined !== stderrPipe) {
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
                os.close(stdoutPipe[1]);
            }
            if (undefined !== stderrPipe) {
                os.close(stderrPipe[1]);
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
     * @return {Promise} same promise as the one returned by {run} method
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
        os.kill(this._state.pid, os.SIGSTOP);
        this._paused = true;
        if (undefined !== this._cb.pause) {
            this._cb.pause({
                pid:this._state.pid
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
        os.kill(this._state.pid, os.SIGCONT);
        this._paused = false;
        if (undefined !== this._cb.resume) {
            this._cb.resume({
                pid:this._state.pid
            });
        }
    }

    /**
     * Kill the child process
     *
     * @param {integer} signal (default = SIGTERM)
     */
    kill(signal = os.SIGTERM) {
        // do nothing if process is not running
        if (undefined === this._state.pid || this._didStop) {
            return;
        }
        // resume process if it is paused
        if (this._paused) {
            os.kill(this._state.pid, os.SIGCONT);
        }
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
            pid:0,
            exitCode:0,
            didTimeout:false
        };
        this._output = {
            stdout:'',
            stderr:''
        };
    }

}

/**
 * Run a command and return stdout
 *
 * @param {string[]|string} cmdline command line to execute. If a {string} is passed, it will be splitted into a {string[]}
 * @param {object} opt options
 * @param {boolean} opt.usePath if {true}, the file is searched in the PATH environment variable (default = {true})
 * @param {string} opt.cwd set the working directory of the new process
 * @param {integer} opt.uid if defined, process uid will be set using setuid
 * @param {integer} opt.gid if defined, process gid will be set using setgid
 * @param {object} opt.env define child process environment (if not defined, use the environment of parent process)
 * @param {boolean} opt.replaceEnv if {true}, ignore parent environment when setting child environment (default = {true})
 * @param {boolean} opt.useShell if {true}, run command using '/bin/sh -c' (default = {false})
 * @param {string} opt.shell full path to shell (default = '/bin/sh', ignored if {opt.useShell} is {false})
 * @param {boolean} opt.newSession if {true} setsid will be used (ie: child will not receive SIGINT sent to parent) (default = {false})
 * @param {boolean} opt.redirectStderr if {true} stderr will be redirected to stdout (default = {false})
 * @param {boolean} opt.lineBuffered if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
 * @param {boolean} opt.trim if {true} stdout & stderr content will be trimmed (default = {true})
 * @param {boolean} opt.skipBlankLines if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
 * @param {integer} opt.timeout maximum number of seconds before killing child (if {undefined}, no timeout will be configured)
 * @param {integer} opt.timeoutSignal signal to use when killing the child after timeout (default = SIGTERM, ignored if {opt.timeout} is not defined)
 * @param {integer} opt.stdin if defined, sets the stdin handle used by child process (it will be rewind)
 *                            NB: don't share the same handle between multiple instances
 * @param {boolean} opt.ignoreError if {true} promise will resolve to the content of stdout even if process exited with a non zero code
 * @param {integer} opt.bufferSize size (in bytes) of the buffer used to read from process stdout & stderr streams (default = {512})
 *
 * @return {Promise} promise which will resolve to the content of stdout in case process exited with zero or {opt.ignoreError} is {true}
 *                   and will an throw an {Error} with the content of stderr and following extra extra properties :
 *                     - {state} (as returned by {run})
 */
const exec = async (cmdline, opt) => {
    const options = Object.assign({}, opt);
    const ignoreError = (true === options.ignoreError);
    delete options.ignoreError;
    // supporting {opt.stdout} does not make sense here
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
    const err = new Error(message);
    err.state = state;
    throw err;
}

/**
 * Wait asynchronously until a given process is terminated
 * NB: method will resolve if EPERM is returned by os
 *
 * @param {integer} pid process pid
 * @param {integer} pollDelay  delay in ms between polling
 *
 * @return {Promise} promise which will resolve once the process is gone
 */
const waitpid = async (pid, pollDelay = 250) => {
    for (;;) {
        if (0 != os.kill(pid, 0)) {
            return;
        }
        await wait(pollDelay);
    }
}

export default exec;

export {
    Process,
    exec,
    waitpid
};
