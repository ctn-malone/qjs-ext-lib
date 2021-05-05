"use strict;"

/*
    Simple wrappers around ssh binary

        - It can be used to execute remote command through SSH but not to establish interactive SSH sessions
        - It does not support password authentication
        - It does not support password for keys (use ssh-agent or {SshAgent} wrapper)

    Following ssh options are NOT SUPPORTED

        - ProxyCommand (too complicated to handle through log parsing)
        - LogLevel (needs to be debug1 for parsing to work)
        - LocalForward, RemoteForward, DynamicForward (forwarding should be handled using adhoc constructor options)

    NB: behaviour of stdout/stderr depends on whether or not a pseudo terminal is allocated
    
        - if a pseudo terminal is allocated using -t
            * both stdout & stderr will be multiplexed
            * EOL will be \r\n
            * terminating the ssh process will terminate the remote process
      
        - otherwise 
            * stdout & stderr won't be multiplexed
            * EOL will be as sent by remote server
            * terminating the ssh process will not terminate the remote process
    
    The state of an SSH connection can be detected by analysing the stderr output of ssh binary
    
        - debug1: Connecting to => host could be resolved
        - debug1: Connection established => connected
        - debug1: SSH2_MSG_NEWKEYS sent => host key matches
        - debug1: Authentication succeeded => auth ok
        - debug1: Requesting no-more-sessions@openssh.com => session is setup (no remote port forwarding requested)
        - debug1: All remote forwarding requests processed => session is setup (one or more remote port forwarding were requested)
        - debug1: Sending command => process stdout/stderr will start
        - debug1: [...] free: client-session => remote process exited

    Output can be mixed with debug lines which will need to be stripped

        Example:

        debug1: Sending command: date ; sleep 0.5 ; date
        Mon Apr 19 13:18:48 CEST 2021
        debug1: client_input_channel_req: channel 0 rtype exit-status reply 0
        debug1: client_input_channel_req: channel 0 rtype eow@openssh.com reply 0
        Mon Apr 19 13:18:48 CEST 2021        


    The reason of an ssh connection failure can be retrieved using {sshErrorReason} property.
    Value can be one of

        - unknown : reason is unknown ;) (this should not happen)
        - ssh_not_found : ssh binary was not found
        - command_error : one argument provided to ssh was wrong
        - resolve_error : hostname could not be resolved
        - connect_error : a connection error occured (timeout, no route ...)
        - host_key_error : the verification of the remote host key failed
        - auth_error : authentication was refused by server
        - forward_error : local or remote forward failed
 */

import { Process } from './process.js';
import { getLines } from './strings.js';

import * as os from 'os';
import * as std from 'std';

const DEFAULT_PORT = 22;

/**
 * Create a simple wrapper around stdout or stderr
 * to deal with \r\n vs \n when a pseudo terminal is allocated
 *
 * Wrapper will have following methods
 * 
 *     - puts 
 *     - log (puts + eol)
 *     - printf
 *     - flush
 *
 * @param {FILE} stream 
 *
 * @return {object}
 */
 const createStreamWrapper = (stream) => {
    const isatty = os.isatty(stream.fileno());
    
    /**
     * Convert \n to \r\n
     *
     * @param {string} str 
     *
     * @return {string}
     */
    const convertLnToCrLn = (str) => {
        return str.replace(/([^\r])\n/g, "$1\r\n");
    }

    /**
     * Convert \r\n to \n
     *
     * @param {string} str 
     *
     * @return {string}
     */
     const convertCrLnToLn = (str) => {
        return str.replace(/\r\n/g, "\n");
    }

    const wrapper = {
        puts:(str) => {
            if (isatty) {
                str = convertLnToCrLn(str);
            }
            else {
                str = convertCrLnToLn(str);
            }
            stream.puts(str);
        },
        log:(str) => {
            str += "\n";
            if (isatty) {
                str = convertLnToCrLn(str);
            }
            else {
                str = convertCrLnToLn(str);
            }
            stream.puts(str);
        },
        printf:(fmt, ...args) => {
            let str = std.sprintf(fmt, ...args);
            if (isatty) {
                str = convertLnToCrLn(str);
            }
            else {
                str = convertCrLnToLn(str);
            }
            stream.puts(str);
        },
        flush:stream.flush
    };

    return wrapper;
}

/**
 * Get signal from ssh logs
 *
 * @param {string} content
 *
 * @return {integer|undefined}
 */
const getSignal = (content) => {
    const index = content.indexOf('Killed by signal');
    if (-1 == index) {
        return undefined;
    }
    content = content.substring(index + 16);
    const arr = content.match(/[0-9]+/);
    if (null === arr) {
        return undefined;
    }
    const signal = parseInt(arr[0]);
    return signal;
}

/**
 * Strip line containing Killed by ...
 * 
 * @param {string} content 
 * 
 * @return {string}
 */
const stripKilledByLine = (content) => {
    const index = content.indexOf('Killed by signal');
    if (-1 == index) {
        return content;
    }
    let newContent = content.substring(0, index);
    const eolIndex = content.indexOf("\n", index + 1);
    if (-1 != eolIndex) {
        newContent += content.substring(eolIndex + 1);
    }
    return newContent;
}

/**
 * Extract local port forwarding information from SSH logs
 * Method will be called by {parseContent} when client
 * connects to forwading port
 * 
 * @param {string} str
 * 
 * @return {object|undefined} {"port":integer, "destAddr":string, "destPort":integer}
 */
const getLocalPortForwarding = (content) => {
    let strIndex = content.lastIndexOf('debug1: Connection to port ');
    if (-1 == strIndex) {
        return undefined;
    }
    let str = content.substring(strIndex).trimStart();
    let eolIndex = str.indexOf("\n");
    if (-1 != eolIndex) {
        str = str.substring(0, eolIndex).trimEnd();
    }
    /*
        Example: "debug1: Connection to port 10003 forwarding to dest2 port 23 requested."
     */
    const arr = str.split(' ');
    const obj = {
        port:parseInt(arr[4]),
        destAddr:arr[7],
        destPort:parseInt(arr[9])
    };
    if (isNaN(obj.port) || isNaN(obj.destPort)) {
        return undefined;
    }
    return obj;
}

/**
 * Extract local port forwarding error from SSH logs
 * 
 * @param {string} content 
 * 
 * @return {string|undefined}
 */
const getLocalPortForwardingError = (content) => {
    let strIndex = content.indexOf(': open failed: ');
    if (-1 == strIndex) {
        return undefined;
    }
    let str = content.substring(strIndex + 15).trimStart();
    let eolIndex = str.indexOf("\n");
    if (-1 != eolIndex) {
        str = str.substring(0, eolIndex).trimEnd();
    }
    return str;
}

/**
 * Extract port forwarding error from SSH logs
 * 
 * @param {string} content 
 * 
 * @return {string|undefined}
 */
 const getRemotePortForwardingError = (content) => {
    let strIndex = content.indexOf('connect_to ');
    if (-1 == strIndex) {
        return undefined;
    }
    let str = content.substring(strIndex);
    let eolIndex = str.indexOf("\n");
    if (-1 != eolIndex) {
        str = str.substring(0, eolIndex).trimEnd();
    }
    return str;
}


/**
 * Remove debug lines (ie: lines starting with "debug1: ") in a given string
 *
 * Debug lines are expected to be complete (ie: ending with "\n")
 *
 * @param {string} content 
 *
 * @return {string}
 */
 const stripDebugLines = (content) => {
    let newContent = '';
    let strIndex, eolIndex;
    let start = 0;
    // remove debug lines
    while (-1 != (strIndex = content.indexOf("debug1: ", start))) {
        eolIndex = content.indexOf("\n", strIndex + 1);
        newContent += content.substring(start, strIndex);
        start = eolIndex + 1;
    }
    // no debug line
    if (undefined === eolIndex) {
        return content;
    }
    newContent += content.substring(eolIndex + 1);

    return newContent;
}

/**
 * Get dynamic ports definition (remote port fowarding) from ssh client output
 *
 * @param {string} content
 *
 * @return {object[]|undefined}
 */
const getDynamicRemotePorts = (content) => {
    const ports = [];
    let str;
    let strIndex, eolIndex;
    let start = 0;
    while (-1 != (strIndex = content.indexOf("debug1: Updating allowed port ", start))) {
        eolIndex = content.indexOf("\n", strIndex + 1);
        if (-1 != eolIndex) {
            str = content.substring(strIndex, eolIndex).trimEnd();
        }
        else {
            str = content.substring(strIndex);
        }
        /*
            Example: "debug1: Updating allowed port 39930 for forwarding to host 127.0.0.1 port 22"
         */
        const arr = str.split(' ');
        if (12 == arr.length) {
            const port = {};
            port.remotePort = parseInt(arr[4]);
            if (!isNaN(port.remotePort)) {
                port.localAddr = arr[9];
                port.localPort = parseInt(arr[11]);
                if (!isNaN(port.localPort)) {
                    ports.push(port);
                }
            }
        }
        if (-1 == eolIndex) {
            break;
        }
        start = eolIndex + 1;
    }
    if (0 == ports.length) {
        return undefined;
    }
    return ports;
}

/**
 * Parse output from ssh client
 *
 * @param {string} content content from ssh client
 * @param {object} steps object indicating which steps have been performed
 * @param {object} opt
 * @param {boolean} opt.hasCommand whether or not we have a non-empty command
 * @param {boolean} opt.hasRemotePortForwarding whether or not we have remote port forwarding
 * @param {boolean} opt.hasLocalPortForwarding whether or not we have remote port forwarding
 *
 * @return {object} {"output":string|undefined}
 */
 const parseContent = (content, steps, opt) => {

    /*  
        NB: Output can be mixed with debug lines which will need to be stripped
        
            Example:

            debug1: Sending command: date ; sleep 0.5 ; date
            Mon Apr 19 13:18:48 CEST 2021
            debug1: client_input_channel_req: channel 0 rtype exit-status reply 0
            debug1: client_input_channel_req: channel 0 rtype eow@openssh.com reply 0
            Mon Apr 19 13:18:48 CEST 2021        
     */
     
    /*
        If we don't have any debug line, try to get output if one of the conditions is true

        - session is setup and we don't have any command
        - command was sent

     */
    if (-1 == content.indexOf('debug1: ')) {
        // we only have output
        if ((steps.didSetupSession && !opt.hasCommand) || steps.didSendCommand) {
            return {output:content};
        }
        // ignore content
        return {};
    }

    let strIndex, eolIndex;
    let str;
    const result = {};

    // we don't have any command
    if (!opt.hasCommand) {
        // session is setup => handle output
        if (steps.didSetupSession) {
            /*
                check if a local forwarding is being setup (ie: client connected to forwarded port)
             */
            if (opt.hasLocalPortForwarding) {
                result.localPortForwarding = getLocalPortForwarding(content);
            }
            /*
                check if session was closed
             */
            strIndex = content.indexOf('channel 0: free:');
            if (-1 != strIndex) {
                steps.didExit = true;
            }
            // remote process did not exit yet
            str = stripDebugLines(content);
            if ('' != str) {
                result.output = str;
            }
            return result;
        }
    }
    // we have a command
    else {
        // if command was sent, handle output
        if (steps.didSendCommand) {
            /*
                check if a local forwarding is being setup (ie: client connected to forwarded port)
             */
            if (opt.hasLocalPortForwarding) {
                result.localPortForwarding = getLocalPortForwarding(content);
            }
            /*
                check if remote process exited
             */
            strIndex = content.indexOf('free: client-session');
            // remote process exited
            if (-1 != strIndex) {
                steps.didExit = true;
                // find the beginning of the line
                const start = content.lastIndexOf('debug1: ', strIndex);
                str = content.substring(0, start);
                str = stripDebugLines(str);
                if ('' != str) {
                    result.output = str;
                }
                return result;
            }
            // remote process did not exit yet
            str = stripDebugLines(content);
            if ('' != str) {
                result.output = str;
            }
            return result;
        }

        /*
            check if we have a debug line indicating command was sent
         */
        strIndex = content.indexOf('debug1: Sending command');
        // command was sent
        if (-1 != strIndex) {
    
            steps.didResolveHostname = true;
            steps.didConnect = true;
            steps.didAcceptHostKey = true;
            steps.didAuthenticate = true;
            steps.didSetupSession = true;
            steps.didSendCommand = true;
    
            if (opt.hasRemotePortForwarding) {
                result.remotePorts = getDynamicRemotePorts(content);
            }
    
            // debug lines are expected to be complete (ie: ending with "\n")
            eolIndex = content.indexOf("\n", strIndex);
    
            /*
                check if remote process exited
             */
            strIndex = content.indexOf('free: client-session');
            // remote process exited
            if (-1 != strIndex) {
                steps.didExit = true;
                // find the beginning of the line
                const start = content.lastIndexOf('debug1: ', strIndex);
                // get output
                str = content.substring(eolIndex + 1, start);
                str = stripDebugLines(str);
                if ('' != str) {
                    result.output = str;
                }
            }
            // remote process did not exit yet, get output
            str = content.substring(eolIndex + 1);
            str = stripDebugLines(str);
            if ('' != str) {
                result.output = str;
            }
            return result;
        }
    }

    /*
        No session setup, no command sent yet => we only have debug lines to process
     */
    let start = 0;
    while (-1 != (strIndex = content.indexOf('debug1: ', start))) {
        eolIndex = content.indexOf("\n", strIndex);
        // debug lines are expected to be complete (ie: ending with "\n")
        str = content.substring(strIndex, eolIndex).trimEnd();
        
        /*
            check if a new step has been reached (sorry about the indentation hell ;))
         */
        // hostname resolution
        if (!steps.didResolveHostname) {
            if (str.startsWith('debug1: Connecting to')) {
                steps.didResolveHostname = true;
            }
        }
        else {
            // connection
            if (!steps.didConnect) {
                if (str.startsWith('debug1: Connection established')) {
                    steps.didConnect = true;
                }
            }
            else {
                // host key validation
                if (!steps.didAcceptHostKey) {
                    if (str.startsWith('debug1: SSH2_MSG_NEWKEYS sent')) {
                        steps.didAcceptHostKey = true;
                    }
                }
                else {
                    // authentication
                    if (!steps.didAuthenticate) {
                        if (str.startsWith('debug1: Authentication succeeded')) {
                            steps.didAuthenticate = true;
                        }
                    }
                    // session setup
                    else {
                        if (!steps.didSetupSession) {
                            if (!opt.hasRemotePortForwarding) {
                                if (str.startsWith('debug1: Requesting no-more-sessions@openssh.com')) {
                                    steps.didSetupSession = true;
                                }
                            }
                            /*
                                if remort port forwarding is enabled, wait until all
                                forwarding requests have been processed successfully
                            */
                            else {
                                const remotePorts = getDynamicRemotePorts(str);
                                if (undefined !== remotePorts) {
                                    if (undefined == result.remotePorts) {
                                        result.remotePorts = [];
                                    }
                                    remotePorts.forEach((e) => {
                                        result.remotePorts.push(e);
                                    });
                                }
                                if (str.startsWith('debug1: All remote forwarding requests processed')) {
                                    steps.didSetupSession = true;
                                }
                            }
                        }

                    }
                }
            }
        }
        start = eolIndex + 1;
    }
    return result;
}

/**
 * Initialize process state
 *
 * @return {object}
 */
const getDefaultProcessState = () => {
    return {
        pid:0,
        exitCode:0,
        didTimeout:false,
        wasCancelled:false
    };
}

/**
 * Check whether or not string is a valid integer
 *
 * @param {string} str 
 * @param {object} opt options
 * @param {boolean} opt.min min value (included)
 * @param {boolean} opt.max max value (included)
 *
 * @return {boolean}
 */
const isValidInteger = (str, opt) => {
    if (undefined === opt) {
        opt = {};
    }
    const value = parseInt(str);
    if (isNaN(value)) {
        return false;
    }
    if (undefined !== opt.min) {
        if (value < opt.min) {
            return false;
        }
    }
    if (undefined !== opt.max) {
        if (value > opt.max) {
            return false;
        }
    }
    return true;
}

/*
    option we don't support
 */
const UNSUPPORTED_OPTIONS = {
    ProxyCommand:true,
    LogLevel:true,
    LocalForward:true,
    RemoteForward:true,
    DynamicForward:true
};

class Ssh {

    /**
     * Constructor
     *
     * @param {string} host hostname or user@hostname or user@hostname:port
     * @param {string} cmd command to execute remotely (can be empty)
     * @param {object} opt options
     * @param {integer} opt.port port (default = {DEFAULT_PORT})
     * @param {string} opt.user login user (defaults to current user)
     * @param {boolean} opt.ignoreUserConfig (if {true}, ~/.ssh/config will be ignored) (default = {true})
     * @param {boolean} opt.checkHostKey whether or not host key should be checked (default = {false})
     * @param {integer} opt.connectTimeout maximum number of seconds allowed for connection (defaults to OpenSSH default)
     * @param {integer} opt.pseudoTerminal if {true}, a pseudo terminal will be allocated (default = {false})
     * @param {string} opt.identityFile full path to identify file (can be used to bypass agent)
     * @param {object} opt.env dictionary of environment variables to define on remote host
     * @param {object|object[]} opt.localForward local port forwarding
     * @param {string} opt.localForward.remoteAddr remote binding ip address (by default, use remote hostname)
     * @param {integer} opt.localForward.remotePort remote binding port (mandatory)
     * @param {string} opt.localForward.localAddr local binding ip address (default = "127.0.0.1", use "*" to bind to all interfaces)
     * @param {integer} opt.localForward.localPort local binding port (by default, use remote binding port)
     * @param {object|object[]} opt.remoteForward remote binding port forwarding
     * @param {string} opt.remoteForward.remoteAddr remote binding ip address (default = "127.0.0.1", use "*" to bind to all interfaces)
     * @param {integer} opt.remoteForward.remotePort remote binding port (default = {0}, dynamically allocated by server)
     * @param {string} opt.remoteForward.localAddr local binding ip address (default = "127.0.0.1")
     * @param {integer} opt.remoteForward.localPort local binding port (by default, use remote binding port if != {0})
     * @param {object} opt.sshOpt dictionary of custom SSH options (see https://linux.die.net/man/5/ssh_config)
     * @param {boolean} opt.newSession if {true} setsid will be used (ie: ssh process will not receive SIGINT sent to parent) (default = {false})
     * @param {integer} opt.maxTime maximum number of seconds before killing SSH process (if {undefined}, no max time will be configured)
     * @param {boolean} opt.redirectStderr if {true} stderr will be redirected to stdout using shell redirection (default = {false})
     * @param {boolean} opt.lineBuffered if {true} call stdout & stderr event listeners only after a line is complete (default = {false})
     * @param {boolean} opt.normalizeEol if {true}, '\r' characters will be removed from ssh output (default = {false})
     * @param {boolean} opt.trim if {true} stdout & stderr content will be trimmed (default = {true}) (does not apply to stdout & stderr event handlers)
     * @param {boolean} opt.skipBlankLines if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
     * @param {any} opt.context user define context (can be used to identify ssh requests later by client code)
     */
    constructor(host, cmd, opt) {
        if (undefined === opt) {
            opt = {};
        }
        this._user = undefined;
        this._port = DEFAULT_PORT;
        this._host = host;

        // get user, host & port
        let index = this._host.indexOf('@');
        if (-1 != index) {
            this._user = this._host.substring(0, index);
            this._host = this._host.substring(index + 1);
        }
        index = this._host.indexOf(':');
        if (-1 != index) {
            this._port = parseInt(this._host.substring(index + 1));
            this._host = this._host.substring(0, index);
        }
        if (undefined !== opt.user) {
            this._user = opt.user;
        }
        if (undefined !== opt.port) {
            this._port = parseInt(opt.port);
        }
        if (isNaN(this._port)) {
            this._port = DEFAULT_PORT;
        }

        this._cmd = '';
        const remoteCmd = cmd.trim();
        // don't set environment if we don't have any command
        if ('' != remoteCmd) {
            if (undefined !== opt.env) {
                for (const [name, value] of Object.entries(opt.env)) {
                    this._cmd += `${name}=${value} `;
                }
                if ('' != this._cmd) {
                    this._cmd = `export ${this._cmd}`;
                    this._cmd += '; ';
                }
            }
            this._cmd += cmd;
        }

        // use to ensure a single process is running
        this._runPromise = undefined;
        this._process = undefined;
        // promise returned once session is setup
        this._sessionSetupPromise = undefined;

        /*
            callbacks
         */
        this._cb = {
            stdout:undefined,
            stderr:undefined,
            exit:undefined
        };

        /*
            output
         */
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
        // by default do not normalize eol
        this._normalizeEol = (true === opt.normalizeEol);

        // whether or not port forwarding has been defined
        this._portForwarding = {
            local:{enabled:false},
            remote:{enabled:false, dynamic:{enabled:false, ports:[]}}
        };

        /*
            ssh arguments
         */
        this._sshArgs = [
            'ssh',
            '-v',
            // disable password support
            '-o', 'BatchMode=yes',
            // ssh(1) should terminate the connection if it cannot set up all port forwardings
            '-o', 'ExitOnForwardFailure=yes',
            // to ensure connection won't be closed by intermediary routers 
            '-o', 'ServerAliveInterval=30',
            '-p', this._port
        ];
        // by default, ignore user config
        if (false !== opt.ignoreUserConfig) {
            this._sshArgs.push('-F');
            this._sshArgs.push('/dev/null');
        }
        // if we don't have any command, add N flag
        if ('' == remoteCmd) {
            this._sshArgs.push('-N');
        }
        // by default don't allocate a pseudo terminal
        if (true === opt.pseudoTerminal) {
            // don't allocate if we don't have any command
            if ('' != remoteCmd) {
                this._sshArgs.push('-t');
            }
        }
        // by default, disable strict host checking
        if (true !== opt.checkHostKey) {
            this._sshArgs.push('-o');
            this._sshArgs.push('StrictHostKeyChecking=no');
        }
        // connect timeout
        if (undefined !== opt.connectTimeout) {
            if (!isValidInteger(opt.connectTimeout, {min:1})) {
                throw new TypeError(`Argument 'opt.connectTimeout' should be an integer > 0 (${opt.connectTimeout})`);
            }
            const value = parseInt(opt.connectTimeout);
            this._sshArgs.push('-o');
            this._sshArgs.push(`ConnectTimeout=${value}`);
        }
        // identify file
        if (undefined !== opt.identityFile && '' != opt.identityFile) {
            this._sshArgs.push('-o');
            this._sshArgs.push(`IdentityFile=${opt.identityFile}`);
            this._sshArgs.push('-o');
            this._sshArgs.push('IdentitiesOnly=yes');
        }
        // local port forwarding
        if (undefined !== opt.localForward) {
            // convert to array if needed
            let list = opt.localForward;
            if (!Array.isArray(list)) {
                list = [list];
            }
            if (0 != list.length) {
                this._portForwarding.local.enabled = true;
            }
            list.forEach((forward, index) => {
                let localAddr = '127.0.0.1', localPort, remoteAddr, remotePort;
                // remote addr
                remoteAddr = this._host;
                if (undefined !== forward.remoteAddr && '' != forward.remoteAddr) {
                    remoteAddr = forward.remoteAddr;
                }
                // remote port 
                if (undefined === forward.remotePort) {
                    throw new Error(`Argument 'opt.localForward[${index}].remotePort' is missing`);
                }
                if (!isValidInteger(forward.remotePort, {min:1, max:65535})) {
                    throw new TypeError(`Argument 'opt.localForward[${index}].remotePort' should be a valid port number (${forward.remotePort})`);
                }
                remotePort = parseInt(forward.remotePort);
                // local addr
                if (undefined !== forward.localAddr && '' != forward.localAddr) {
                    localAddr = forward.localAddr;
                }
                // local port (use same as remote port by default)
                localPort = remotePort;
                if (undefined !== forward.localPort) {
                    if (!isValidInteger(forward.localPort, {min:1, max:65535})) {
                        throw new TypeError(`Argument 'opt.localForward[${index}].localPort' should be a valid port number (${forward.localPort})`);
                    }
                    localPort = parseInt(forward.localPort);
                }
                this._sshArgs.push('-o');
                this._sshArgs.push(`LocalForward=${localAddr}:${localPort} ${remoteAddr}:${remotePort}`);
            });
        }
        // remote port forwarding
        if (undefined !== opt.remoteForward) {
            // convert to array if needed
            let list = opt.remoteForward;
            if (!Array.isArray(list)) {
                list = [list];
            }
            if (0 != list.length) {
                this._portForwarding.remote.enabled = true;
            }
            list.forEach((forward, index) => {
                let remoteAddr = '127.0.0.1', remotePort = 0, localAddr = '127.0.0.1', localPort;
                // remote addr
                if (undefined !== forward.remoteAddr && '' != forward.remoteAddr) {
                    remoteAddr = forward.remoteAddr;
                }
                // remote port
                if (undefined !== forward.remotePort) {
                    if (!isValidInteger(forward.remotePort, {min:0, max:65535})) {
                        throw new TypeError(`Argument 'opt.remoteForward[${index}].remotePort' should be a valid port number (${forward.remotePort})`);
                    }
                    remotePort = parseInt(forward.remotePort);
                }
                if (0 == remotePort) {
                    this._portForwarding.remote.dynamic.enabled = true;
                }
                // local addr
                if (undefined !== forward.localAddr && '' != forward.localAddr) {
                    localAddr = forward.localAddr;
                }
                // local port (use same as remote port by default)
                if (0 != remotePort) {
                    localPort = remotePort;
                }
                else if (undefined === forward.localPort || '' == forward.localPort) {
                    throw new Error(`Argument 'opt.remoteForward[${index}].localPort' is missing`);
                }
                if (undefined !== forward.localPort) {
                    if (!isValidInteger(forward.localPort, {min:1, max:65535})) {
                        throw new TypeError(`Argument 'opt.remoteForward[${index}].localPort' should be a valid port number (${forward.localPort})`);
                    }
                    localPort = parseInt(forward.localPort);
                }
                this._sshArgs.push('-o');
                this._sshArgs.push(`RemoteForward=${remoteAddr}:${remotePort} ${localAddr}:${localPort}`);
            });
        }        
        // custom options
        if (undefined !== opt.sshOpt) {
            for (const [name, value] of Object.entries(opt.sshOpt)) {
                if (undefined !== UNSUPPORTED_OPTIONS[name]) {
                    continue;
                }
                if (Array.isArray(value)) {
                    value.forEach((v) => {
                        this._sshArgs.push('-o');
                        this._sshArgs.push(`${name}=${v}`);
                    });
                }
                else {
                    this._sshArgs.push('-o');
                    this._sshArgs.push(`${name}=${value}`);
                }
            }
        }

        // host
        if (undefined !== this._user) {
            this._sshArgs.push(`${this._user}@${this._host}`);
        }
        else {
            this._sshArgs.push(this._host);
        }
        // command
        if ('' != this._cmd) {
            this._sshArgs.push(this._cmd);
            /*
                Don't redirect locally using pipes because output order
                is likely to be messed up. Use remote shell redirection instead
             */
            if (true === opt.redirectStderr) {
                this._sshArgs.push('2>&1');
            }
        }

        // duration is ms
        this._duration = 0;

        // will be filled with the error returned by SSH in case of failure
        this._sshError = undefined;
        // a string which will identify the reason of the failure
        this._sshErrorReason = undefined;

        // by default don't use maxTime
        this._maxTime = undefined;
        if (undefined !== opt.maxTime) {
            const value = parseInt(opt.maxTime);
            if (!isNaN(value) && value > 0) {
                this._maxTime = value;
            }
        }
        // by default, don't use a new session to run ssh
        this._newSession = false;
        if (true === opt.newSession) {
            this._newSession = true;
        }

        this._state = getDefaultProcessState();

        // whether or not request is being cancelled
        this._isBeingCancelled = false;

        this._context = opt.context;
    }

    /**
     * Define event handler
     * Any previously defined handler will be replaced
     *
     * @param {string} eventType (stdout|stderr|exit)
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
        }
    }    

    /**
     * Return {true|false} when ssh connection has been terminated
     *
     * @return {boolean} {true} on success, {false} in case of SSH error or if remote process exited with a non zero code
     */
    async run() {
        // do nothing if process is still running
        if (undefined !== this._runPromise) {
            return this._runPromise;
        }
        this._reset();
        this._runPromise = new Promise( async (resolveRunPromise) => {

            const startTime = Date.now();

            const cmdline = [...this._sshArgs]
            this._process = new Process(cmdline, {
                timeout:this._maxTime,
                newSession:this._newSession
            });

            // keep track of connection steps
            const steps = {
                // whether or not hostname was successfully resolved
                didResolveHostname:false,
                // whether or not connection to remote host could be established
                didConnect:false,
                // whether or not remote host key was accepted
                didAcceptHostKey:false,
                // whether or not authentication was successful
                didAuthenticate:false,
                // whether or not session was successfully setup
                didSetupSession:false,
                // whether or not remote command was sent
                didSendCommand:false,
                // whether or not connection terminated
                didExit:false
            };

            // in case SSH is killed by a signal
            let signal;

            // current local port forwarding
            let currentLocalPortForwarding;

            let sessionSetupCb;
            let sessionSetupPromiseResolved = false;
            this._sessionSetupPromise = new Promise((resolveSessionSetupPromise) => {
                sessionSetupCb = (success) => {
                    sessionSetupPromiseResolved = true;
                    return resolveSessionSetupPromise(success);
                };
            });

            /*
                stderr handler
            */
            let stderrIncompleteLine = '';
            let tmpStderr = '';
            this._process.setEventListener('stderr', (obj) => {
                if (steps.didExit) {
                    if (undefined === signal) {
                        signal = getSignal(obj.data);
                    }
                    return;
                }
                if (this._normalizeEol) {
                    obj.data = obj.data.replace(/\r/g, '');
                }
                if (!steps.didSetupSession) {
                    tmpStderr += obj.data;
                }
                const parseResult = parseContent(obj.data, steps, {
                    hasLocalPortForwarding:this._portForwarding.local.enabled,
                    hasRemotePortForwarding:this._portForwarding.remote.enabled,
                    hasCommand:('' != this._cmd)
                });
                // update current local port forwarding
                if (undefined !== parseResult.localPortForwarding) {
                    currentLocalPortForwarding = parseResult.localPortForwarding;
                }
                // indicate that session is setup
                if (steps.didSetupSession && !sessionSetupPromiseResolved) {
                    sessionSetupCb(true);
                }
                // update remote ports
                if (undefined !== parseResult.remotePorts) {
                    parseResult.remotePorts.forEach((e) => {
                        this._portForwarding.remote.dynamic.ports.push(e);
                    });
                }
                // update signal
                if (steps.didExit) {
                    if (undefined === signal) {
                        signal = getSignal(obj.data);
                    }
                }
                // no output to process
                if (undefined === parseResult.output) {
                    return;
                }
                // strip "Killed by..." line
                if (steps.didExit) {
                    parseResult.output = stripKilledByLine(parseResult.output);
                    // ignore if we don't have output
                    if ('' == parseResult.output) {
                        return;
                    }
                }
                /*
                    check if we have port forwarding errors
                 */
                // local forward
                if (this._portForwarding.local.enabled) {
                    // only update error if we don't have one
                    if (undefined === this._sshErrorReason) {
                        let sshError = getLocalPortForwardingError(parseResult.output);
                        if (undefined !== sshError) {
                            if (undefined !== currentLocalPortForwarding) {
                                sshError += ` (local port forwarding ${currentLocalPortForwarding.port} => ${currentLocalPortForwarding.destAddr}:${currentLocalPortForwarding.destPort})`;
                            }
                            else {
                                sshError = `${sshError} (local port forwarding)`;
                            }
                            this._sshError = sshError;
                            this._sshErrorReason = 'forward_error';
                            this.cancel();
                        }
                    }
                }
                // remote forward
                if (this._portForwarding.remote.enabled) {
                    // only update error if we don't already have one
                    if (undefined === this._sshErrorReason) {
                        let sshError = getRemotePortForwardingError(parseResult.output);
                        if (undefined !== sshError) {
                            this._sshError = `${sshError} (remote port forwarding)`;
                            this._sshErrorReason = 'forward_error';
                            this.cancel();
                        }
                    }
                }
                // call stderr handler
                if (undefined !== this._cb.stderr) {
                    if (!this._lineBuffered) {
                        this._cb.stderr({pid:this._state.pid, data:parseResult.output});
                        return;
                    }
                    const linesResult = getLines(parseResult.output, stderrIncompleteLine, this._skipBlankLines);
                    linesResult.lines.forEach((str) => {
                        this._cb.stderr({pid:this._state.pid, data:str});
                    });
                    stderrIncompleteLine = linesResult.incompleteLine;
                    return;
                }
                // buffer output
                this._output.stderr += parseResult.output;
            });

            /*
                stdout handler
            */
            let stdoutIncompleteLine = '';
            let tmpStdout = '';
            this._process.setEventListener('stdout', (obj) => {
                if (steps.didExit) {
                    if (undefined === signal) {
                        signal = getSignal(obj.data);
                    }
                    return;
                }
                if (this._normalizeEol) {
                    obj.data = obj.data.replace(/\r/g, '');
                }
                if (!steps.didSetupSession) {
                    tmpStdout += obj.data;
                }
                const parseResult = parseContent(obj.data, steps, {
                    hasLocalPortForwarding:this._portForwarding.local.enabled,
                    remotePortForwarding:this._portForwarding.remote.enabled,
                    hasCommand:('' != this._cmd)
                });
                // update current local port forwarding
                if (undefined !== parseResult.localPortForwarding) {
                    currentLocalPortForwarding = parseResult.localPortForwarding;
                }
                // indicate that session is setup
                if (steps.didSetupSession && !sessionSetupPromiseResolved) {
                    sessionSetupCb(true);
                }
                // update remote ports
                if (undefined !== parseResult.remotePorts) {
                    parseResult.remotePorts.forEach((e) => {
                        this._portForwarding.remote.dynamic.ports.push(e);
                    });
                }
                // update signal
                if (steps.didExit) {
                    if (undefined === signal) {
                        signal = getSignal(obj.data);
                    }
                }
                // no output to process
                if (undefined === parseResult.output) {
                    return;
                }
                // strip "Killed by..." line
                if (steps.didExit) {
                    parseResult.output = stripKilledByLine(parseResult.output);
                    // ignore if we don't have output
                    if ('' == parseResult.output) {
                        return;
                    }
                }
                /*
                    check if we have port forwarding errors
                 */
                // local forward
                if (this._portForwarding.local.enabled) {
                    // only update error if we don't already have one
                    if (undefined === this._sshErrorReason) {
                        let sshError = getLocalPortForwardingError(parseResult.output);
                        if (undefined !== sshError) {
                            if (undefined !== currentLocalPortForwarding) {
                                sshError += ` (local port forwarding ${currentLocalPortForwarding.port} => ${currentLocalPortForwarding.destAddr}:${currentLocalPortForwarding.destPort})`;
                            }
                            else {
                                sshError = `${sshError} (local port forwarding)`;
                            }
                            this._sshError = sshError;
                            this._sshErrorReason = 'forward_error';
                            this.cancel();
                        }
                    }
                }
                // remote forward
                if (this._portForwarding.remote.enabled) {
                    // only update error if we don't have one
                    if (undefined === this._sshErrorReason) {
                        let sshError = getRemotePortForwardingError(parseResult.output);
                        if (undefined !== sshError) {
                            this._sshError = `${sshError} (remote port forwarding)`;
                            this._sshErrorReason = 'forward_error';
                            this.cancel();
                        }
                    }
                }
                // call stdout handler
                if (undefined !== this._cb.stdout) {
                    if (!this._lineBuffered) {
                        this._cb.stdout({pid:this._state.pid, data:parseResult.output});
                        return;
                    }
                    const linesResult = getLines(parseResult.output, stdoutIncompleteLine, this._skipBlankLines);
                    linesResult.lines.forEach((str) => {
                        this._cb.stdout({pid:this._state.pid, data:str});
                    });
                    stdoutIncompleteLine = linesResult.incompleteLine;
                    return;
                }
                // buffer output
                this._output.stdout += parseResult.output;
            });

            const p = this._process.run();
            this._state.pid = this._process.pid;

            this._state = await p;
            this._state.wasCancelled = false;
            
            // ssh error
            if (!steps.didSetupSession) {
                // indicate session could not be setup
                sessionSetupCb(false);

                this._sshError = '';
                this._sshErrorReason = 'unknown';
                
                if ('' !== tmpStderr) {
                    const linesResult = getLines(tmpStderr);
                    if (undefined !== linesResult.incompleteLine) {
                        linesResult.lines.push(linesResult.incompleteLine);
                    }
                    if (0 != linesResult.lines.length) {
                        // find last line which is not a debug line
                        let index = undefined;
                        for (let i = linesResult.lines.length - 1; i >= 0; --i) {
                            if (linesResult.lines[i].startsWith('debug1: ')) {
                                break;
                            }
                            index = i;
                        }
                        if (undefined !== index) {
                            this._sshError = linesResult.lines.slice(index).join("\n").trim();
                        }
                    }
                }
                else if ('' !== tmpStdout) {
                    const linesResult = getLines(tmpStdout);
                    if (undefined !== linesResult.incompleteLine) {
                        linesResult.lines.push(linesResult.incompleteLine);
                    }
                    if (0 != linesResult.lines.length) {
                        // find last line which is not a debug line
                        let index = undefined;
                        for (let i = linesResult.lines.length - 1; i >= 0; --i) {
                            if (linesResult.lines[i].startsWith('debug1: ')) {
                                break;
                            }
                            index = i;
                        }
                        if (undefined !== index) {
                            this._sshError = linesResult.lines.slice(index).join("\n").trim();
                        }
                    }
                }
                if (127 == this._state.exitCode) {
                    this._sshErrorReason = 'ssh_not_found';
                }
                else {
                    if (!steps.didResolveHostname) {
                        if (this._sshError.startsWith('command-line')) {
                            this._sshErrorReason = 'command_error';
                        }
                        else {
                            this._sshErrorReason = 'resolve_error';
                        }
                    }
                    else if (!steps.didConnect) {
                        this._sshErrorReason = 'connect_error';
                    }
                    else if (!steps.didAcceptHostKey) {
                        this._sshErrorReason = 'host_key_error';
                    }
                    else if (!steps.didAuthenticate) {
                        this._sshErrorReason = 'auth_error';
                    }
                    else {
                        if (this._portForwarding.local.enabled) {
                            if (-1 != this._sshError.indexOf('channel_setup_fwd_listener_tcpip')) {
                                this._sshErrorReason = 'forward_error';
                            }
                        }
                        if (this._portForwarding.remote.enabled) {
                            if (-1 != this._sshError.indexOf('remote port forwarding failed')) {
                                this._sshErrorReason = 'forward_error';
                            }
                        }
                    }
                }
            }

            /*
                check if we have incomplete lines and update buffered content
             */
            // stdout
            if (undefined !== this._cb.stdout) {
                if (this._lineBuffered && '' != stdoutIncompleteLine) {
                    this._cb.stdout({pid:this._state.pid, data:stdoutIncompleteLine});
                }
            }
            else {
                if ('' != this._output.stdout) {
                    // remove empty lines
                    if (this._skipBlankLines) {
                        this._output.stdout = this._output.stdout.replace(/^\s*\n/gm, '');
                    }
                    // trim buffered content
                    if (this._trim) {
                        this._output.stdout = this._output.stdout.trim();
                    }
                }
            }
            // stderr
            if (undefined !== this._cb.stderr) {
                if (this._lineBuffered && '' != stderrIncompleteLine) {
                    this._cb.stderr({pid:this._state.pid, data:stderrIncompleteLine});
                }
            }
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

            const endTime = Date.now();
            this._duration = (endTime - startTime);

            // update process state using signal
            if (undefined !== signal) {
                this._state.exitCode = -signal;
                this._state.signal = Process.getSignalName(signal);
            }

            // process failed
            if (0 != this._state.exitCode) {
                // we might have cancelled the process using SIGINT
                if (this._isBeingCancelled && 'SIGINT' === this._state.signal) {
                    this._state.wasCancelled = true;
                }
                // call handler
                if (undefined !== this._cb.exit) {
                    const obj = {state:this.state};
                    if (undefined !== this._sshErrorReason) {
                        obj.sshErrorReason = this._sshErrorReason;
                        obj.sshError = this._sshError;
                    }
                    if (undefined !== this._context) {
                        obj.context = this._context;
                    }
                    this._cb.exit(obj);
                }
                return resolveRunPromise(false);
            }

            this._runPromise = undefined;
            this._process = undefined;
            this._sessionSetupPromise = undefined;

            // call handler
            if (undefined !== this._cb.exit) {
                const obj = {state:this.state};
                if (undefined !== this._context) {
                    obj.context = this._context;
                }
                this._cb.exit(obj);
            }
            
            return resolveRunPromise(true);
        });
        
        return this._runPromise;
    }

    /**
     * Wait until session is setup (successfull auth AND all forwards successfully processed)
     *
     * @return {boolean} {true} if session was setup successfully, {false} otherwise
     */
    async waitForSessionSetup() {
        if (undefined === this._runPromise) {
            this.run();
        }
        return this._sessionSetupPromise;
    }

    /**
     * Cancel ssh process
     *
     * @return {boolean} {true} if process was successfully cancelled, {false} otherwise
     */
    cancel() {
        if (undefined === this._process) {
            return false;
        }
        if (this._isBeingCancelled) {
            return true;
        }
        this._isBeingCancelled = true;
        this._process.kill(os.SIGINT);
        return true;
    }

    /**
     * Get dynamic remote ports
     *
     * @return {object[]|undefined}
     */
    get remotePorts() {
        if (!this._portForwarding.remote.dynamic.enabled) {
            return undefined;
        }
        const ports = [];
        this._portForwarding.remote.dynamic.ports.forEach((e) => {
            ports.push(Object.assign({}, e));
        });
        return ports;
    }

    /**
     * Get SSH command line
     * 
     * @return {string}
     */
    get cmdline() {
        return this._sshArgs.join(' ');
    }

    /**
     * Get SSH host
     */
     get host() {
        return this._host;
    }

    /**
     * Get SSH port
     * 
     * @return {integer}
     */
    get port() {
        return this._port;
    }

    /**
     * Get SSH user
     * 
     * @return {string|undefined}
     */
    get user() {
        return this._user;
    }

    /**
     * Get SSH uri (host:port|user@host:port)
     * 
     * @return {string}
     */
    get uri() {
        if (undefined === this._user) {
            return `${this._host}:${this._port}`;
        }
        return `${this._user}@${this._host}:${this._port}`;
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
     * Retrieve process state (pid, exitCode ...)
     *
     * @return {object}
     */
    get state() {
        return Object.assign({}, this._state);
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
     * Indicate whether or not request failed
     *
     * @return {boolean}
     */
    get failed() {
        if (this.sshFailed) {
            return true;
        }
        if (this.commandFailed) {
            return true;
        }
        return false;
    }

    /**
     * Indicate whether or not process timed out
     *
     * @return {boolean}
     */
    get didTimeout() {
        return this._state.didTimeout;
    }

    /**
     * Indicate whether or not process was cancelled
     *
     * @return {boolean}
     */
    get wasCancelled() {
        return this._state.wasCancelled;
    }

    /**
     * Indicate whether or not ssh failed
     *
     * @return {boolean}
     */
    get sshFailed() {
        return (undefined !== this._sshErrorReason);
    } 

    /**
     * Return ssh error
     * Will be {undefined} unless ssh connection failed
     *
     * @return {string|undefined}
     */
    get sshError() {
        return this._sshError;
    }    

    /**
     * Indicates in which step ssh connection failed
     * Will be {undefined} unless ssh connection failed
     *
     * @return {string}
     */
    get sshErrorReason() {
        return this._sshErrorReason;
    }    

    /**
     * Indicates whether or not remote command failed
     *
     * @return {boolean}
     */
     get commandFailed() {
        if (0 != this._state.exitCode) {
            if (!this.sshFailed) {
                return true;
            }
        }
        return false;
    }    
    
    /**
     * Return context
     *
     * @return {any}
     */
    get context() {
        return this._context;
    }

    /**
     * Duration in ms
     *
     * @return {integer}
     */
    get duration() {
        return this._duration;
    }

    /**
     * Reset internal state. Called at the beginning of {run} method
     */
    _reset() {
        this._runPromise = undefined;
        this._process = undefined;
        this._sessionSetupPromise = undefined;
        this._sshError = undefined;
        this._isBeingCancelled = false;
        this._duration = 0;
        this._state = getDefaultProcessState();
        this._output = {
            stdout:'',
            stderr:''
        };
        // reset remote ports
        this._portForwarding.remote.dynamic.ports = [];
    }
}

/**
 * Run a remote command and return stdout
 *
 * @param {string} host hostname or user@hostname or user@hostname:port
 * @param {string} cmd command to execute remotely (cannot be empty)
 * @param {object} opt options
 * @param {integer} opt.port port (default = {DEFAULT_PORT})
 * @param {string} opt.user login user (defaults to current user)
 * @param {boolean} opt.checkHostKey whether or not host key should be checked (default = {false})
 * @param {integer} opt.connectTimeout maximum number of seconds allowed for connection
 * @param {string} opt.identityFile full path to identify file (can be used to bypass agent)
 * @param {object} opt.env dictionary of environment variables to define on remote host
 * @param {boolean} opt.redirectStderr if {true} stderr will be redirected to stdout (default = {false})
 * @param {boolean} opt.trim if {true} stdout & stderr content will be trimmed (default = {true})
 * @param {boolean} opt.skipBlankLines if {true} empty lines will be ignored in both stdout & stderr content (default = {false})
 * @param {boolean} opt.ignoreError if {true} promise will resolve to the content of stdout even if process exited with a non zero code
 *
 * @return {Promise} promise which will resolve to the content of stdout in case process exited with zero or {opt.ignoreError} is {true}
 *                   and will an throw an {Error} with the content of stderr and following extra extra properties :
 *                     - {state} (as returned by {state} property)
 *                     - {sshError} (will be {undefined} if there was no ssh error)
 *                     - {sshErrorReason} (will be {undefined} if there was no ssh error)
 */
const sshExec = async (host, cmd, opt) => {
    if ('' == cmd) {
        throw new Error(`Argument 'cmd' cannot be empty`);
    }
    if (undefined === opt) {
        opt = {};
    }
    const options = {};
    [
        'port', 'user',
        'checkHostKey', 'connectTimeout', 'identityFile', 'env',
        'redirectStderr', 'trim', 'skipBlankLines'
    ].forEach((k) => {
        if (undefined !== opt[k]) {
            options[k] = opt[k];
        }
    });
    const ignoreError = (true === opt.ignoreError);
    
    const ssh = new Ssh(host, cmd, options);
    const result = await ssh.run();
    
    // success
    if (result) {
        return ssh.stdout;
    }

    // failure
    if (ignoreError) {
        return ssh.stdout;
    }
    const err = new Error(ssh.stderr);
    err.state = ssh.state;
    const sshError = ssh.sshError;
    if (undefined !== sshError) {
        err.sshError = sshError;
        err.sshErrorReason = ssh.sshErrorReason;
    }
    throw err;
}

/**
 * Run multiple Ssh objects and return when all sessions are finished
 *
 * @param {Ssh[]} array of {Ssh} objects
 *
 * @return {object[]} array of {"ssh":Ssh,"result":boolean}
 */
 const multiSsh = async (list) => {
    const promises = [];
    list.forEach((item, i) => {
        promises.push(item.run());
    });
    const results = await Promise.all(promises);
    const data = [];
    results.forEach((r, i) => {
        data.push({ssh:list[i], result:r});
    });
    return data;
}

/*
    Minimal wrapper around ssh-agent binary

        - check whether or not agent is running
        - list identities
        - check identities
        - add identities
        - remove identities
 */
const SshAgent = {

    /**
     * Check whether or not agent is running
     *
     * @return {boolean}
     */
    isRunning:async () => {
        const p = new Process('ssh-add -l');
        const state = await p.run();
        return 0 == state.exitCode;
    },
    
    /**
     * List loaded identities
     *
     * @return {object[]} see example below
     */
    /*
        Output example

        [
            {
                "format":"ssh-rsa",
                "data":"...",
                "file":"/home/user/.ssh/id_rsa"
            }
        ]

     */
    listIdentities:async () => {
        const list = [];
        const p = new Process('ssh-add -L');
        const state = await p.run();
        if (0 == state.exitCode) {
            p.stdout.split("\n").forEach((line) => {
                const arr = line.split(' ');
                const item = {format: arr[0], data:arr[1], file:arr[2]};
                list.push(item);
            });
        }
        return list;
    },

    /**
     * Check whether or not an identity is loaded
     *
     * @param {string} file absolute path to SSH key
     *
     * @return {boolean}
     */
    checkIdentity:async (file) => {
        const list = await SshAgent.listIdentities();
        const item = list.find(e => file == e.file);
        return (undefined !== item);
    },

    /**
     * Add an identity to SSH agent
     *
     * @param {string} file absolute path to SSH key
     * @param {object} opt options
     * @param {boolean} opt.checkFirst if {true}, identity won't be added if it is already loaded
     * @param {integer} opt.expiry maximum lifetime in seconds (will be ignored if {opt.checkFirst} is {true})
     *
     * @return {boolean} {true} if identity was added, {false} otherwise
     * @throws {Error} in case of failure (ex: ssh-agent not running)
     */
    addIdentity:async (file, opt) => {
        if (undefined === opt) {
            opt = {};
        }
        // check if we need to load the identity first
        if (true === opt.checkFirst) {
            // identity already exists
            const result = await SshAgent.checkIdentity(file);
            if (result) {
                return false;
            }
        }
        const args = ['ssh-add'];
        // expiry
        if (undefined !== opt.expiry) {
            const expiry = parseInt(opt.expiry);
            if (!isNaN(expiry) && expiry > 0) {
                args.push('-t');
                args.push(`${expiry}`);
            }
        }
        args.push(file);
        const p = new Process(args);
        const state = await p.run();
        if (0 != state.exitCode) {
            const error = new Error(p.stderr);
            throw error;
        }
        return true;
    },

    /**
     * Add default identities (~/.ssh/id_rsa, ~/.ssh/id_dsa...) to SSH agent
     *
     * @param {object} opt options
     * @param {integer} opt.expiry maximum lifetime in seconds
     *
     * @throws {Error} throw an error in case of failure
     */
     addDefaultIdentities:async (opt) => {
        if (undefined === opt) {
            opt = {};
        }
        const args = ['ssh-add'];
        // expiry
        if (undefined !== opt.expiry) {
            const expiry = parseInt(opt.expiry);
            if (!isNaN(expiry) && expiry > 0) {
                args.push('-t');
                args.push(`${expiry}`);
            }
        }
        const p = new Process(args);
        const state = await p.run();
        if (0 != state.exitCode) {
            const error = new Error(p.stderr);
            throw error;
        }
    },

    /**
     * Remove an identity from SSH agent
     *
     * @param {string} file absolute path to SSH key
     *
     * @return {boolean} {true} if identity existed and was removed, {false} otherwise
     */
    removeIdentity:async (file) => {
        const args = ['ssh-add', '-d', file];
        const p = new Process(args);
        const state = await p.run();
        if (0 != state.exitCode) {
            return false;
        }
        return true;
    },

    /**
     * Remove default identities (~/.ssh/id_rsa, ~/.ssh/id_dsa...) from SSH agent
     */
     removeDefaultIdentities:async () => {
        const args = ['ssh-add', '-d'];
        const p = new Process(args);
        const state = await p.run();
        if (0 != state.exitCode) {
            return false;
        }
        return true;
    },
    
    /**
     * Remove all identities from SSH agent
     */
    removeAllIdentities:async () => {
        const p = new Process(['ssh-add', '-D']);
        await p.run();
    }

};

Ssh.out = createStreamWrapper(std.out);
Ssh.err = createStreamWrapper(std.err);
Ssh.puts = Ssh.out.puts;
Ssh.log = Ssh.out.log;

export {
    Ssh,
    sshExec,
    multiSsh,
    SshAgent
}


