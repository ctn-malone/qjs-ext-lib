"use strict;"

/*
    Simple wrappers around curl binary
 */

import { Process } from './process.js';

import * as os from 'os';
import * as std from 'std';

// in case of timeout, curl process will exit with this error code 
const CURL_ERR_TIMEOUT = 28;

// size of the buffer used in case of conditional output (10MB)
const CONDITIONAL_OUTPUT_BUFFER_SIZE = 1024 * 1024 * 10;

class Curl {

    /**
     * Constructor
     *
     * @param {string} url
     * @param {object} opt options
     * @param {string} opt.method HTTP method (default = "GET")
     * @param {string} opt.userAgent
     * @param {boolean} opt.insecure if {true} ignore SSL errors (default = {false})
     * @param {object} opt.headers dictionary of extra headers (each value can be a {string} or a {string[]})
     * @param {object} opt.cookies dictionary of cookies (each value should be a {string} or an {object} with a {value} property))
     * @param {boolean} opt.followRedirects whether or not HTTP redirects should be followed (default = {true})
     * @param {integer} opt.maxRedirects maximum number of HTTP redirects to follow (by default, use curl default)
     *                                   Will be ignored if {opt.followRedirects} is {false}
     * @param {integer} opt.stdout if defined, sets the stdout handle used by child process (it will be rewind)
     *                             NB: - don't share the same handle between multiple instances
     * @param {string|object} opt.outputFile if set, output will be redirected to this file
     *                                       When using a {string}, {opt.outputFile} should be the path of the output file
     *                                       Will be ignored if {opt.stdout} was set
     * @param {string} opt.outputFile.filepath path of the output file (mandatory)
     * @param {boolean} opt.outputFile.conditionalOutput if {true}, output file will only be written if {opt.outputFile.onCheckCondition}
     *                                                   returns {true} (default = {false})
     * @param {function} opt.outputFile.onCheckCondition function which take a {Curl} instance as single parameter
     *                                                   It should return {true} if case output file should be written, {false} otherwise
     *                                                   Default implementation returns {true} if curl request succeeded
     * @param {integer} opt.maxTime maximum number of seconds allowed for the transfer
     * @param {object} opt.data data to send as application/x-www-form-urlencoded
     *                          Content type will automatically be set to application/x-www-form-urlencoded
     *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     * @param {object|string|true} opt.json data to send as application/json
     *                                      Content type will automatically be set to application/json
     *                                      Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                                      Will be ignored if {opt.data} was set
     * @param {string} opt.jsonFile file containing data to send as application/json
     *                              Content type will automatically be set to application/json
     *                              Use '-' for stdin
     *                              Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                              Will be ignored if one of ({opt.data}, {opt.json}) was set
     * @param {string|object} opt.file used to upload a file
     *                                 Content type will automatically be set to multipart/form-data
     *                                 Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                                 Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}) was set
     *                                 When using a {string}, {opt.file} should be the path of the file to upload
     * @param {string} opt.file.filepath path of the local file (mandatory)
     * @param {string} opt.file.name name of the form parameter (default = {"file"})
     * @param {string} opt.file.filename name of the file (defaults to the name of the local file)
     * @param {object} opt.file.formData extra form data
     * @param {string} opt.body file containing the body to send
     *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                          Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}, {opt.file}) was set
     * @param {string} opt.bodyFile body to send 
     *                              Use '-' for stdin
     *                              Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                              Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}, {opt.file}, {opt.body}) was set
     * @param {object} opt.params parameters to add as query string
     * @param {boolean} opt.normalizeHeaders if {true}, header names in response will be converted to lower case (default = {true})
     * @param {boolean} opt.returnHeadersAs indicates how response headers should be returned
     *                                      - "string" (default) : if an header appears multiple times, only the first value will be kept
     *                                      - "array" : always return an array of values for each header
     *                                      - "auto" : return an array of values only for headers which appear multiple times
     * @param {boolean} opt.parseJson if {true}, automatically parse JSON in responses (default = {true})
     * @param {boolean} opt.failOnHttpError if {true}, {run} method will return {false} in case status code is not in [200, 299] (default = {false})
     * @param {object} opt.basicAuth basic HTTP authentication {"username":"string", "password":"string"}
     * @param {string} opt.bearerToken bearer token to use. Will be ignored if {opt.basicAuth} was set
     * @param {string} opt.jwt JWT token to use (with or without JWT prefix). Will be ignored if one ({opt.basicAuth}, {opt.bearerToken}) was set
     * @param {any} opt.context user define context (can be used to identify curl request later by client code)
     * @param {integer} opt.stdin : if defined, sets the stdin handle used by curl process (it will be rewind)
     *                              NB: don't share the same handle between multiple instances
     */
    constructor(url, opt) {
        if (undefined === opt) {
            opt = {};
        }

        this._url = url;

        // curl arguments
        this._curlArgs = [
            'curl',
            '-D', '/dev/stderr',
            // ignore .curlrc
            '-q'
        ]

        // user agent
        if (undefined !== opt.userAgent) {
            const value = opt.userAgent.trim();
            if ('' != value) {
                this._curlArgs.push('-A');
                this._curlArgs.push(value);
            }
        }

        // whether or not SSL errors should be ignored
        if (true === opt.insecure) {
            this._curlArgs.push('-k');
        }

        // extra headers
        let contentType;
        if (undefined !== opt.headers && 'object' == typeof opt.headers) {
            for (const [key, value] of Object.entries(opt.headers)) {
                const headerName = key.toLowerCase();
                const values = Array.isArray(value) ? value : [value];
                for (const v of values) {
                    this._curlArgs.push('-H');
                    const header = `${key}: ${v}`
                    this._curlArgs.push(header);
                    // only handle the first one
                    if ('content-type' == headerName) {
                        // in case we have '; charset...'
                        const arr = v.trim().split(';');
                        contentType = arr[0].trim();
                        break;
                    }
                }
            }
        }

        // cookies
        if (undefined !== opt.cookies && 'object' == typeof opt.cookies) {
            const arr = [];
            for (const [key, value] of Object.entries(opt.cookies)) {
                if ('string' == typeof value) {
                    arr.push(`${key}=${value}`);
                }
                else if (undefined !== value.value) {
                    arr.push(`${key}=${value.value}`);
                }
            }
            if (0 != arr.length) {
                const header = `Cookie: ${arr.join('; ')}`;
                this._curlArgs.push('-H');
                this._curlArgs.push(header);
            }
        }

        // http method
        this._method = 'GET';
        if (undefined !== opt.method) {
            const method = opt.method.toUpperCase();
            switch (method) {
                case 'GET':
                case 'POST':
                case 'DELETE':
                case 'PUT':
                case 'OPTIONS':
                case 'HEAD':
                case 'PATCH':
                    this._method = method;
                    break;
            }
        }
        this._curlArgs.push('-X');
        this._curlArgs.push(this._method);

        // follow redirects
        if (false !== opt.followRedirects) {
            this._curlArgs.push('-L');
            if (undefined !== opt.maxRedirects) {
                const value = parseInt(opt.maxRedirects);
                if (!isNaN(value) && value > 0) {
                    this._curlArgs.push('--max-redirs');
                    this._curlArgs.push(value);
                }
            }
        }

        /**
         * By default, only write output if request succeeded
         * 
         * @param {object} curlInstance {Curl} instance
         * 
         * @returns {boolean}
         */
        const onCheckCondition = (curlInstance) => {
            return !curlInstance.failed;
        }

        // output
        this._outputFile = undefined;
        this._stdout = undefined;
        if (undefined !== opt.stdout) {
            this._stdout = opt.stdout;
        }
        else  if (undefined !== opt.outputFile) {
            // we only have filepath
            if ('string' == typeof opt.outputFile) {
                const value = opt.outputFile.trim();
                if ('' != value) {
                    this._outputFile = {
                        filepath:value,
                        conditionalOutput:false,
                        onCheckCondition:onCheckCondition
                    }
                }
            }
            else {
                if (undefined !== opt.outputFile.filepath) {
                    const value = opt.outputFile.filepath.trim();
                    if ('' != value) {
                        this._outputFile = {
                            filepath:value,
                            conditionalOutput:(true === opt.outputFile.conditionalOutput),
                            onCheckCondition:onCheckCondition
                        };
                        // custom conditional output
                        if (this._outputFile.conditionalOutput) {
                            if (undefined !== opt.outputFile.onCheckCondition && 'function' == typeof opt.outputFile.onCheckCondition) {
                                this._outputFile.onCheckCondition = opt.outputFile.onCheckCondition;
                            }
                        }
                    }
                }
            }
            if (!this._outputFile.conditionalOutput) {
                this._curlArgs.push('-o');
                this._curlArgs.push(this._outputFile.filepath);
            }
        }

        // connect timeout
        if (undefined !== opt.connectTimeout) {
            const value = parseInt(opt.connectTimeout);
            if (!isNaN(value) && value > 0) {
                this._curlArgs.push('--connect-timeout');
                this._curlArgs.push(value);
            }
        }

        // overall timeout
        if (undefined !== opt.maxTime) {
            const value = parseInt(opt.maxTime);
            if (!isNaN(value) && value > 0) {
                this._curlArgs.push('--max-time');
                this._curlArgs.push(value);
            }
        }

        // basic auth
        if (undefined !== opt.basicAuth) {
            if (undefined !== opt.basicAuth.username && undefined !== opt.basicAuth.password) {
                this._curlArgs.push('-u');
                const str = `${opt.basicAuth.username}:${opt.basicAuth.password}`;
                this._curlArgs.push(str);
            }
        }
        // bearer token
        else if (undefined !== opt.bearerToken) {
            this._curlArgs.push('-H');
            const header = `Authorization: Bearer ${opt.bearerToken}`;
            this._curlArgs.push(header);
        }
        // JWT token
        else if (undefined !== opt.jwt) {
            let token = opt.jwt;
            // add prefix if needed
            if (!token.startsWith('JWT ')) {
                token = `JWT ${token}`;
            }
            this._curlArgs.push('-H');
            const header = `Authorization: ${token}`;
            this._curlArgs.push(header);
        }

        /*
            Only allow data/body for PUT, POST, DELETE, PATCH
         */
        if ('PUT' == this._method || 'POST' == this._method ||
            'DELETE' == this._method || 'PATCH' == this._method) {
            // form-urlencoded
            if (undefined !== opt.data && 'object' == typeof opt.data) {
                if ('application/x-www-form-urlencoded' != contentType) {
                    this._curlArgs.push('-H');
                    this._curlArgs.push(`Content-Type: application/x-www-form-urlencoded`);
                }
                for (const [key, value] of Object.entries(opt.data)) {
                    if (Array.isArray(value)) {
                        for (let i = 0; i < value.length; ++i) {
                            this._curlArgs.push('-d');
                            const pair = `${key}[]=${encodeURIComponent(value[i])}`;
                            this._curlArgs.push(pair);
                        }
                    }
                    else {
                        this._curlArgs.push('-d');
                        const pair = `${key}=${encodeURIComponent(value)}`;
                        this._curlArgs.push(pair);
                    }
                }
            }
            // json body
            else if (undefined !== opt.json) {
                let json;
                if ('object' == typeof opt.json) {
                    json = JSON.stringify(opt.json);
                }
                else if ('string' == typeof opt.json) {
                    json = opt.json;
                }
                if (undefined !== json || true === opt.json) {
                    if ('application/json' != contentType) {
                        this._curlArgs.push('-H');
                        this._curlArgs.push(`Content-Type: application/json`);
                    }
                    if (true !== opt.json) {
                        this._curlArgs.push('-d');
                        // no need to escape anything since we're using exec
                        this._curlArgs.push(json);
                    }
                }
            }
            // json body from json file
            else if (undefined !== opt.jsonFile) {
                if ('application/json' != contentType) {
                    this._curlArgs.push('-H');
                    this._curlArgs.push(`Content-Type: application/json`);
                }
                this._curlArgs.push('-d');
                this._curlArgs.push(`@${opt.jsonFile}`);
            }
            else if (undefined !== opt.file) {
                /*
                    Content-Type will be set automatically to
                    multipart/form-data by curl
                */
                let name = 'file';
                let filepath;
                let filename;
                let formData;
                // single file path
                if ('string' == typeof opt.file) {
                    filepath = opt.file;
                }
                else if ('object' == typeof opt.file) {
                    if (undefined !== opt.file.filepath && 'string' == typeof opt.file.filepath) {
                        filepath = opt.file.filepath;
                        if (undefined !== opt.file.filename && 'string' == typeof opt.file.filename) {
                            filename = opt.file.filename;
                        }
                        if (undefined !== opt.file.name && 'string' == typeof opt.file.name) {
                            name = opt.file.name;
                        }
                        if (undefined !== opt.file.formData && 'object' == typeof opt.file.formData) {
                            formData = opt.file.formData;
                        }
                    }
                }
                if (undefined !== filepath) {
                    this._curlArgs.push('-F');
                    let arg = `${name}=@${filepath}`;
                    if (undefined !== filename) {
                        arg += `;filename=${filename}`;
                    }
                    this._curlArgs.push(arg);
                    // extra forma data
                    if (undefined !== formData) {
                        for (const [key, value] of Object.entries(formData)) {
                            this._curlArgs.push('-F');
                            this._curlArgs.push(`${key}=${value}`);
                        }
                    }
                }
            }
            // raw content
            else if (undefined !== opt.body && 'string' == typeof opt.body) {
                this._curlArgs.push('-d');
                // no need to escape anything since we're using exec
                this._curlArgs.push(opt.body);
            }
            // raw content from file
            else if (undefined !== opt.bodyFile) {
                this._curlArgs.push('-d');
                this._curlArgs.push(`@${opt.bodyFile}`);
            }
        }
        // url & query string
        let finalUrl = url;
        if (undefined !== opt.params && 'object' == typeof opt.params) {
            let qs = '';
            for (const [key, value] of Object.entries(opt.params)) {
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; ++i) {
                        if ('' != qs) {
                            qs += '&';
                        }
                        qs += `${key}[]=${encodeURIComponent(value[i])}`;
                    }
                }
                else {
                    if ('' != qs) {
                        qs += '&';
                    }
                    qs += `${key}=${encodeURIComponent(value)}`;
                }
            }
            if ('' != qs) {
                finalUrl += `?${qs}`;
            }
        }
        this._curlArgs.push('--url');
        this._curlArgs.push(finalUrl);

        // by default normalize response headers (convert to lowercase)
        this._normalizeHeaders = true;
        if (false === opt.normalizeHeaders) {
            this._normalizeHeaders = false;
        }
        // by default ignore duplicate headers
        this._returnHeadersAs = 'string';
        if (undefined !== opt.returnHeadersAs) {
            switch (opt.returnHeadersAs) {
                case 'string':
                case 'array':
                case 'auto':
                    this._returnHeadersAs = opt.returnHeadersAs;
            }
        }

        // by default automatically parse json responses
        this._parseJson = true;
        if (false === opt.parseJson) {
            this._parseJson = false;
        }

        // by default don't fail on http error
        this._failOnHttpError = false;
        if (true === opt.failOnHttpError) {
            this._failOnHttpError = true;
        }

        // use to ensure a single process is running
        this._promise = undefined;
        this._process = undefined;

        // duration is ms
        this._duration = 0;

        // will be filled with the error returned by curl in case of failure
        this._curlError = undefined;

        // whether or not there was a timeout
        this._didTimeout = false;
        // whether or not request is being cancelled
        this._isBeingCancelled = false;
        // the signal used to cancel the process
        this._cancelSignal = undefined;

        // whether or not request was cancelled
        this._wasCancelled = false;

        this._context = opt.context;

        // response
        this._responseHeaders = undefined;
        this._responseCookies = undefined;
        this._contentType = undefined;
        this._body = undefined;
        this._status = undefined;

        // stdin
        this._stdin = undefined;
        if (undefined !== opt.stdin) {
            this._stdin = opt.stdin;
        }
    }

    /**
     * Return {true|false} when curl has ended
     * Result depends on Process state + http code
     */
    async run() {
        
        // do nothing if process is still running
        if (undefined !== this._promise) {
            return this._promise;
        }
        this._reset();

        const startTime = Date.now();

        const cmdline = [...this._curlArgs]
        const processOpt = {};
        if (undefined !== this._stdin) {
            processOpt.stdin = this._stdin;
        }
        let conditionalOutputTmpFile = undefined;
        if (undefined !== this._stdout) {
            processOpt.stdout = this._stdout;
        }
        // in case of conditional output, pass a temporary file as stdout to process
        else if (undefined !== this._outputFile && this._outputFile.conditionalOutput) {
            conditionalOutputTmpFile = std.tmpfile();
            processOpt.stdout = conditionalOutputTmpFile.fileno();
        }

        this._process = new Process(cmdline, processOpt);
        this._promise = this._process.run();
        const state = await this._promise;

        const endTime = Date.now();
        this._duration = (endTime - startTime);

        // process failed
        if (0 != state.exitCode) {
            this._curlError = this._process.stderr.trim();
            // only keep curl error and ignore anything before it
            const index = this._curlError.indexOf('curl:');
            if (-1 != index) {
                this._curlError = this._curlError.substring(index);
            }
            if (CURL_ERR_TIMEOUT == state.exitCode) {
                this._didTimeout = true;
            }
            // we might have cancelled the process using a signal
            if (this._isBeingCancelled && this._cancelSignal == (-state.exitCode)) {
                this._wasCancelled = true;
            }
            this._promise = undefined;
            this._process = undefined;
            if (undefined !== conditionalOutputTmpFile) {
                conditionalOutputTmpFile.close();
            }
            return false;
        }
        /*
            Parse headers
         */

        const stderr = this._process.stderr.trim();

        // ignore all content until first "HTTP/" (ie: discard beginning of curl progress info)
        const firstHttpPos = stderr.indexOf('HTTP/');
        if (-1 == firstHttpPos) {
            if (undefined !== conditionalOutputTmpFile) {
                conditionalOutputTmpFile.close();
            }
            throw new Error(`Missing status line`);
        }
        const headers = stderr.substring(firstHttpPos).split("\r\n");
        
        // remove last entry (end of curl progress info)
        headers.pop();

        const nonStatusHeaders = [];
        // status line
        let statusLine;
        for (let i = 0; i < headers.length; ++i) {
            if (headers[i].startsWith('HTTP/')) {
                statusLine = headers[i];
            }
            else {
                nonStatusHeaders.push(headers[i]);
            }
        }
        if (undefined === statusLine) {
            if (undefined !== conditionalOutputTmpFile) {
                conditionalOutputTmpFile.close();
            }
            throw new Error(`Missing status line`);
        }
        const status = this._getStatus(statusLine);
        if (undefined === status) {
            if (undefined !== conditionalOutputTmpFile) {
                conditionalOutputTmpFile.close();
            }
            throw new Error(`Invalid status line (${statusLine})`);
        }
        this._status = status;

        // headers
        const responseHeaders = {};
        const setCookieHeaders = [];
        nonStatusHeaders.forEach((headerLine, i) => {
            const pos = headerLine.indexOf(':');
            // invalid header
            if (-1 == pos) {
                return;
            }
            let name = headerLine.substring(0, pos);
            const normalizedName = name.toLowerCase();
            const value = headerLine.substring(pos + 1).trim();
            if ('content-type' == normalizedName) {
                // in case we have '; charset...'
                const arr = value.split(';');
                this._contentType = arr[0].toLowerCase();
            }
            else if ('set-cookie' == normalizedName) {
                setCookieHeaders.push(value);
            }
            const headerName = this._normalizeHeaders ? normalizedName : name;
            // always return an array of values
            if ('array' == this._returnHeadersAs) {
                if (undefined === responseHeaders[headerName]) {
                    responseHeaders[headerName] = [];
                }
                responseHeaders[headerName].push(value);
            }
            // return an array only if an header appears multiple time
            else if ('auto' == this._returnHeadersAs) {
                if (undefined !== responseHeaders[headerName]) {
                    // convert to an array
                    if (!Array.isArray(responseHeaders[headerName])) {
                        responseHeaders[headerName] = [responseHeaders[headerName]];
                    }
                    responseHeaders[headerName].push(value);
                }
                else {
                    responseHeaders[headerName] = value;
                }
            }
            // only keep first value
            else {
                responseHeaders[headerName] = value;
            }   
        });
        this._responseHeaders = responseHeaders;
        this._responseCookies = this._parseSetCookieHeaders(setCookieHeaders);

        // compute final status
        let didFail = false;
        if (this._status.code < 200 || this._status.code > 299) {
            if (this._failOnHttpError) {
                didFail = true;
            }
        }

        // body
        this._body = this._process.stdout.trim();
        if (undefined === this._stdout) {
            // if no output file was used, try to parse body
            if (undefined === this._outputFile) {
                if ('application/json' == this._contentType && this._parseJson) {
                    try {
                        const body = JSON.parse(this._body);
                        this._body = body;
                    }
                    catch (e) {
                        // invalid JSON, do nothing, keep raw body
                    }
                }
            }
            // check condition
            else if (undefined !== conditionalOutputTmpFile) {
                const canWrite = this._outputFile.onCheckCondition(this);
                if (canWrite) {
                    let errObj;
                    const destFile = std.open(this._outputFile.filepath, 'wb', errObj);
                    if (null === destFile) {
                        conditionalOutputTmpFile.close();
                        throw new Error(`Could not open dest file (${errObj.errno})`);
                    }
                    const buffer = new Uint8Array(CONDITIONAL_OUTPUT_BUFFER_SIZE);
                    let size;
                    while (0 != (size = conditionalOutputTmpFile.read(buffer.buffer, 0, CONDITIONAL_OUTPUT_BUFFER_SIZE))) {
                        destFile.write(buffer.buffer, 0, size);
                    }
                    destFile.close();
                }
                conditionalOutputTmpFile.close();
            }
        }

        this._promise = undefined;
        this._process = undefined;

        return !didFail;
    }

    /**
     * Cancel curl process
     * 
     * @param {object} opt options
     * @param {integer} opt.signal signal to use (default = {SIGINT})
     * 
     * @return {boolean} {true} if process was successfully cancelled, {false} otherwise
     */
    cancel(opt) {
        if (undefined === this._process) {
            return false;
        }
        if (this._isBeingCancelled) {
            return true;
        }
        let signal = os.SIGINT;
        if (undefined !== opt && undefined !== opt.signal) {
            signal = opt.signal;
        }
        this._isBeingCancelled = true;
        this._cancelSignal = signal;
        this._process.kill(signal);
        return true;
    }

    /**
     * Parse status line
     *
     * @param {string} statusLine
     *
     * @return {object|undefined} {"code":integer, "text":string}
     */
    _getStatus(statusLine) {
        const arr = statusLine.split(' ');
        arr.shift();
        let isValid = true;
        const statusCode = parseInt(arr.shift());
        // invalid HTTP code
        if (isNaN(statusCode) || statusCode < 100 || statusCode >= 600) {
            return undefined;
        }
        // missing status text
        if (0 == arr.length) {
            return undefined;
        }
        const statusText = arr.join(' ');
        return {
            code:statusCode,
            text:statusText
        }
    }

    /**
     * Parses an array of set-cookie headers values
     * 
     * @param {string|string[]} values array of set-cookie headers values
     * 
     * @return {object} cookies
     */
    _parseSetCookieHeaders(values) {
        const cookies = {};
        const arr = Array.isArray(values) ? values : [values];
        for (const value of arr) {
            const cookiesStrings = splitCookiesString(value);
            for (const cookieString of cookiesStrings) {
                const cookie = parseSetCookieHeader(cookieString);
                cookies[cookie.name] = cookie;
            }
        }
        return cookies;
    }    

    /**
     * Get curl command line
     * 
     * @return {string}
     */
    get cmdline() {
        return this._curlArgs.join(' ');
    }

    /**
     * Indicate whether or not request failed (curl failure or HTTP failure)
     *
     * @return {boolean}
     */
    get failed() {
        if (this.curlFailed) {
            return true;
        }
        if (this.httpFailed) {
            if (this._failOnHttpError) {
                return true;
            }
        }
        return false;
    }

    /**
     * Indicate whether or not request timed out
     *
     * @return {boolean}
     */
    get didTimeout() {
        return this._didTimeout;
    }

    /**
     * Indicate whether or not request was cancelled
     *
     * @return {boolean}
     */
    get wasCancelled() {
        return this._wasCancelled;
    }

    /**
     * Indicate whether or not curl failed
     *
     * @return {boolean}
     */
    get curlFailed() {
        return (undefined !== this._curlError);
    }

    /**
     * Indicate whether or not HTTP request failed (ie: statusCode in [200, 299])
     * Will be {true} if {run} was not called or curl failed
     *
     * @return {boolean}
     */
    get httpFailed() {
        if (undefined === this._status) {
            return true;
        }
        return (this._status.code < 200 || this._status.code > 299);
    }

    /**
     * Return curl error
     * Will be {undefined} unless curl failed
     *
     * @return {string|undefined}
     */
    get curlError() {
        return this._curlError;
    }

    /**
     * Return error (curl error or http error)
     *
     * @return {string|undefined}
     */
    get error() {
        if (undefined !== this._curlError) {
            return this._curlError;
        }
        if (undefined !== this._status) {
            if (this._status.code < 200 || this._status.code > 299) {
                return `${this._status.code} ${this._status.text}`;
            }
        }
        return undefined;
    }

    /**
     * Return HTTP method
     *
     * @return {string} GET, POST ...
     */
    get method() {
        return this._method;
    }

    /**
     * Return url
     *
     * @return {string}
     */
    get url() {
        return this._url;
    }

    /**
     * Response body
     * Will be {undefined} if {run} was not called, curl failed or there is no body
     *
     * @return {object|string|undefined}
     */
    get body() {
        return this._body;
    }

    /**
     * Content type of response
     * Will be {undefined} if {run} was not called or if curl failed
     *
     * @return {object|undefined}
     */
    get contentType() {
        if (undefined === this._contentType) {
            return undefined;
        }
        return this._contentType;
    }

    /**
     * Response headers (deep copy)
     * Will be {undefined} if {run} was not called or if curl failed
     *
     * @return {object|undefined}
     */
    get headers() {
        if (undefined === this._responseHeaders) {
            return undefined;
        }
        return Object.assign({}, this._responseHeaders);
    }

    /**
     * Retrieve all response cookies (deep copy)
     * Will be {undefined} if {run} was not called or if curl failed
     * 
     * @return {object|undefined} cookies
     */
    get cookies() {
        if (undefined === this._responseCookies) {
            return undefined;
        }
        const result = {};
        for (const cookie of Object.values(this._responseCookies)) {
            result[cookie.name] = Object.assign({}, cookie);
        }
        return result;
    }

    /**
     * Retrieve a single response cookie (deep copy)
     * Will be {undefined} if {run} was not called or if curl failed
     * 
     * @param {string} name cookie name
     * 
     * @return {object|undefined} cookie
     */
    getCookie(name) {
        if (undefined === this._responseCookies) {
            return undefined;
        }
        if (undefined === this._responseCookies[name]) {
            return undefined;
        }
        return Object.assign({}, this._responseCookies[name]);
    }

    /**
     * Retrieve the value of single response cookie
     * Will be {undefined} if {run} was not called or if curl failed
     * 
     * @param {string} name cookie name
     * 
     * @return {string|undefined} cookie
     */
     getCookieValue(name) {
        if (undefined === this._responseCookies) {
            return undefined;
        }
        return this._responseCookies[name]?.value;
    }

    /**
     * Indicates whether or not a given response cookie exist
     * 
     * @param {string} name cookie name
     * 
     * @return {boolean}
     */
    hasCookie(name) {
        if (undefined === this._responseCookies) {
            return false;
        }
        return undefined !== this._responseCookies[name];
    }

    /**
     * Return HTTP code
     * Will be {undefined} if {run} was not called or if curl failed
     *
     * @return {integer|undefined}
     */
    get statusCode() {
        if (undefined === this._status) {
            return undefined;
        }
        return this._status.code;
    }

    /**
     * Return HTTP code & text
     * Will be {undefined} if {run} was not called or if curl failed
     *
     * @return {object|undefined} {"code":integer, "text":string}
     */
    get status() {
        if (undefined === this._status) {
            return undefined;
        }
        return {
            code:this._status.code,
            text:this._status.text
        }
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
        this._promise = undefined;
        this._process = undefined;
        this._curlError = undefined;
        this._didTimeout = false;
        this._isBeingCancelled = false;
        this._wasCancelled = false;
        this._responseHeaders = undefined;
        this._responseCookies = undefined;
        this._body = undefined;
        this._status = undefined;
        this._contentType = undefined;
        this._duration = 0;
    }

}

/**
 * Run a curl request and return body
 *
 * @param {string} url
 * @param {object} opt options
 * @param {string} opt.method HTTP method (default = "GET")
 * @param {string} opt.userAgent
 * @param {boolean} opt.insecure if {true} ignore SSL errors (default = {false})
 * @param {object} opt.headers dictionary of extra headers
 * @param {boolean} opt.followRedirects whether or not HTTP redirects should be followed (default = {true})
 * @param {integer} opt.maxRedirects maximum number of HTTP redirects to follow (by default, use curl default)
 *                                   Will be ignored if {opt.followRedirects} is {false}
 * @param {integer} opt.stdout if defined, sets the stdout handle used by child process (it will be rewind)
 *                             NB: - don't share the same handle between multiple instances
 * @param {string|object} opt.outputFile if set, output will be redirected to this file
 *                                       When using a {string}, {opt.outputFile} should be the path of the output file
 *                                       Will be ignored if {opt.stdout} was set
 * @param {string} opt.outputFile.filepath path of the output file (mandatory)
 * @param {boolean} opt.outputFile.conditionalOutput if {true}, output file will only be written if {opt.outputFile.onCheckCondition}
 *                                                   returns {true} (default = {false})
 * @param {function} opt.outputFile.onCheckCondition function which take a {Curl} instance as single parameter
 *                                                   It should return {true} if case output file should be written, {false} otherwise
 *                                                   Default implementation returns {true} if curl request succeeded
 * @param {integer} opt.connectTimeout maximum number of seconds allowed for connection
 * @param {integer} opt.maxTime maximum number of seconds allowed for the transfer
 * @param {object} opt.data data to send as application/x-www-form-urlencoded
 *                          Content type will automatically be set to application/x-www-form-urlencoded
 *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 * @param {object|string|true} opt.json data to send as application/json
 *                                      Content type will automatically be set to application/json
 *                                      Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                                      Will be ignored if {opt.data} was set
 * @param {string} opt.jsonFile file containing data to send as application/json
 *                              Content type will automatically be set to application/json
 *                              Use '-' for stdin
 *                              Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                              Will be ignored if one of ({opt.data}, {opt.json}) was set
 * @param {string|object} opt.file used to upload a file
 *                                 Content type will automatically be set to multipart/form-data
 *                                 Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                                 Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}) was set
 *                                 When using a {string}, {opt.file} should be the path of the file to upload
 * @param {string} opt.file.filepath path of the local file (mandatory)
 * @param {string} opt.file.name name of the form parameter (default = {"file"})
 * @param {string} opt.file.filename name of the file (defaults to the name of the local file)
 * @param {object} opt.file.formData extra form data
 * @param {string} opt.body body to send
 *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                          Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}, {opt.file}) was set
 * @param {string} opt.bodyFile body to send 
 *                              Use '-' for stdin
 *                              Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                              Will be ignored if one of ({opt.data}, {opt.json}, {opt.jsonFile}, {opt.file}, {opt.body}) was set
 * @param {object} opt.params parameters to add as query string
 * @param {boolean} opt.parseJson if {true}, automatically parse JSON in responses (default = {true})
 * @param {boolean} opt.failOnHttpError if {true}, {run} method will return {false} in case status code is not in [200, 299] (default = {false})
 * @param {object} opt.basicAuth basic HTTP authentication {"username":"string", "password":"string"}
 * @param {string} opt.bearerToken bearer token to use. Will be ignored if {opt.basicAuth} was set
 * @param {string} opt.jwt JWT token to use (with or without JWT prefix). Will be ignored if one ({opt.basicAuth}, {opt.bearerToken}) was set
 * @param {integer} opt.stdin : if defined, sets the stdin handle used by curl process (it will be rewind)
 *                              NB: don't share the same handle between multiple instances
 * @param {boolean} opt.ignoreError if {true}, promise will resolve to the response's body even if curl failed or HTTP failed
 *
 * @return {Promise} promise which will resolve to the body in case of success
 *                   and will an throw an {Error} with the body/curl error as error message and following extra properties :
 *                      - {status} : object|undefined as returned by {status} property
 *                      - {body} : string|object|undefined as returned by {body} property
 *                      - {context} : any as returned by {context} property
 */
const curlRequest = async (url, opt) => {
    const options = Object.assign({}, opt);
    const ignoreError = (true === options.ignoreError);
    delete options.ignoreError;
    const c = new Curl(url, opt);
    const success = await c.run();
    if (success) {
        return c.body;
    }
    if (ignoreError) {
        const body = c.body;
        if (undefined === body) {
            body = '';
        }
        return body;
    }
    let message = c.body;
    if (c.curlFailed) {
        message = c.curlError;
    }
    if ('object' == typeof message) {
        message = JSON.stringify(message);
    }
    const err = new Error(message);
    err.body = c.body;
    err.status = c.status;
    throw err;
}

/**
 * Run multiple Curl objects and return when all requests are finished
 *
 * @param {Curl[]} array of {Curl} objects
 *
 * @return {object[]} array of {"curl":Curl,"result":boolean}
 */
const multiCurl = async (list) => {
    const promises = [];
    list.forEach((item, i) => {
        promises.push(item.run());
    });
    const results = await Promise.all(promises);
    const data = [];
    results.forEach((r, i) => {
        data.push({curl:list[i], result:r});
    });
    return data;
}

/**
 * Set-Cookie header field-values are sometimes comma joined in one string. This splits them without choking on commas
 * that are within a single set-cookie field-value, such as in the Expires portion.
 * This is uncommon, but explicitly allowed - see https://tools.ietf.org/html/rfc2616#section-4.2
 * Node.js does this for every header *except* set-cookie - see https://github.com/nodejs/node/blob/d5e363b77ebaf1caf67cd7528224b651c86815c1/lib/_http_incoming.js#L128
 * React Native's fetch does this for *every* header, including set-cookie.
 * Based on: https://github.com/google/j2objc/commit/16820fdbc8f76ca0c33472810ce0cb03d20efe25
 * Credits to: https://github.com/tomball for original and https://github.com/chrusart for JavaScript implementation
 * 
 * Borrowed from https://github.com/nfriedly/set-cookie-parser/commit/21d45a64b57745691ead23cd2656845af4457d6a ;)
 * 
 * @param {string} cookieString
 * 
 * @return {string[]}
 */
const splitCookiesString = (cookiesString) => {
    const cookiesStrings = [];
    let pos = 0;
    let start;
    let ch;
    let lastComma;
    let nextStart;
    let cookiesSeparatorFound;
  
    const skipWhitespace = () => {
        while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
            pos += 1;
        }
        return pos < cookiesString.length;
    }
  
    const notSpecialChar = () => {
        ch = cookiesString.charAt(pos);
        return ch !== "=" && ch !== ";" && ch !== ",";
    }
  
    while (pos < cookiesString.length) {
        start = pos;
        cookiesSeparatorFound = false;
  
        while (skipWhitespace()) {
            ch = cookiesString.charAt(pos);
            if (ch === ",") {
                // ',' is a cookie separator if we have later first '=', not ';' or ','
                lastComma = pos;
                pos += 1;
  
                skipWhitespace();
                nextStart = pos;
  
                while (pos < cookiesString.length && notSpecialChar()) {
                    pos += 1;
                }
  
                // currently special character
                if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
                    // we found cookies separator
                    cookiesSeparatorFound = true;
                    // pos is inside the next cookie, so back up and return it.
                    pos = nextStart;
                    cookiesStrings.push(cookiesString.substring(start, lastComma));
                    start = pos;
                } 
                else {
                    // in param ',' or param separator ';',
                    // we continue from that comma
                    pos = lastComma + 1;
                }
            } 
            else {
                pos += 1;
            }
        }
  
        if (!cookiesSeparatorFound || pos >= cookiesString.length) {
            cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
        }
    }
    return cookiesStrings;
}

/**
 * Parses a set-cookie header value
 * 
 * Borrowed from https://github.com/nfriedly/set-cookie-parser/commit/21d45a64b57745691ead23cd2656845af4457d6a ;)
 * 
 * @param {string} value set-cookie header value
 * 
 * @return {object} cookie
 */
const parseSetCookieHeader = (value) => {
    const parts = value.split(";").filter(str => 'string' == typeof str && !!str.trim());
    if (0 === parts.length) {
        return {};
    }
    const nameValue = parts.shift().split("=");
    const name = nameValue.shift();
    let val = nameValue.join("="); // everything after the first =, joined by a "=" if there was more than one part
  
    try {
        val = decodeURIComponent(val); // decode cookie value
    } 
    catch (e) {
        // ignore error
    }
  
    const cookie = {
        name: name, // grab everything before the first =
        value: val,
    };
  
    parts.forEach((part) => {
        const sides = part.split("=");
        const key = sides.shift().trimStart().toLowerCase();
        const value = sides.join("=");
        if (key === "expires") {
            cookie.expires = new Date(value);
        } 
        else if (key === "max-age") {
            cookie.maxAge = parseInt(value, 10);
        } 
        else if (key === "secure") {
            cookie.secure = true;
        } 
        else if (key === "httponly") {
            cookie.httpOnly = true;
        } 
        else if (key === "samesite") {
            cookie.sameSite = value;
        } 
        else {
            cookie[key] = value;
        }
        // remove {expires}
        if (0 === cookie.maxAge) {
            delete cookie.expires;
        }
    });
  
    return cookie;
}

export {
    Curl,
    multiCurl,
    curlRequest,
}
