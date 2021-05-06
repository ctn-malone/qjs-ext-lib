"use strict;"

/*
    Simple wrappers around curl binary
 */

import { Process } from './process.js';

import * as os from 'os';

// in case of timeout, curl process will exit with this error code 
const CURL_ERR_TIMEOUT = 28;

class Curl {

    /**
     * Constructor
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
     * @param {string} opt.outputFile if set output will be redirected to this file
     * @param {integer} opt.connectTimeout maximum number of seconds allowed for connection
     * @param {integer} opt.maxTime maximum number of seconds allowed for the transfer
     * @param {object} opt.data data to send as application/x-www-form-urlencoded
     *                          Content type will automatically be set to application/x-www-form-urlencoded
     *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     * @param {object|string|true} opt.json data to send as application/json
     *                                      Content type will automatically be set to application/json
     *                                      Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                                      Will be ignored if {opt.data} was set
     * @param {string|object} opt.file used to upload a file
     *                                 Content type will automatically be set to multipart/form-data
     *                                 Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                                 Will be ignored if one of ({opt.data}, {opt.json}) was set
     *                                 When using a {string}, {opt.file} should be the path of the file to upload
     * @param {string} opt.file.filepath path of the local file (mandatory)
     * @param {string} opt.file.name name of the form parameter (default = {"file"})
     * @param {string} opt.file.filename name of the file (defaults to the name of the local file)
     * @param {string} opt.body body to send
     *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
     *                          Will be ignored if one of ({opt.data}, {opt.json}, {opt.file}) was set
     * @param {object} opt.params parameters to add as query string
     * @param {boolean} opt.normalizeHeaders if {true}, header names in response will be converted to lower case (default = {true})
     * @param {boolean} opt.parseJson if {true}, automatically parse JSON in responses (default = {true})
     * @param {boolean} opt.failOnHttpError if {true}, {run} method will return {false} in case status code is not in [200, 299] (default = {false})
     * @param {object} opt.basicAuth basic HTTP authentication {"username":"string", "password":"string"}
     * @param {string} opt.bearerToken bearer token to use. Will be ignored if {opt.basicAuth} was set
     * @param {any} opt.context user define context (can be used to identify curl request later by client code)
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
                if ('content-type' == headerName) {
                    // in case we have '; charset...'
                    const arr = value.trim().split(';');
                    contentType = arr[0].trim();
                }
                this._curlArgs.push('-H');
                const header = `${key}: ${value}`
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

        // output file
        if (undefined !== opt.outputFile) {
            const value = opt.outputFile.trim();
            if ('' != value) {
                this._curlArgs.push('-o');
                this._curlArgs.push(value);
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
            else if (undefined !== opt.file) {
                /*
                    Content-Type will be set automatically to
                    multipart/form-data by curl
                */
                let name = 'file';
                let filepath;
                let filename;
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
                    }
                }
                if (undefined !== filepath) {
                    this._curlArgs.push('-F');
                    let arg = `${name}=@${filepath}`;
                    if (undefined !== filename) {
                        arg += `;filename=${filename}`;
                    }
                    this._curlArgs.push(arg);
                }
            }
            // raw content
            else if (undefined !== opt.body && 'string' == typeof opt.body) {
                this._curlArgs.push('-d');
                // no need to escape anything since we're using exec
                this._curlArgs.push(opt.body);
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
        this._contentType = undefined;
        this._body = undefined;
        this._status = undefined;
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
        this._process = new Process(cmdline);
        this._promise = this._process.run();
        const state = await this._promise;

        const endTime = Date.now();
        this._duration = (endTime - startTime);

        // process failed
        if (0 != state.exitCode) {
            this._curlError = this._process.stderr.trim();
            if (CURL_ERR_TIMEOUT == state.exitCode) {
                this._didTimeout = true;
            }
            // we might have cancelled the process using a signal
            if (this._isBeingCancelled && this._cancelSignal == (-state.exitCode)) {
                this._wasCancelled = true;
            }
            this._promise = undefined;
            this._process = undefined;
            return false;
        }
        /*
            Parse headers
         */

        const stderr = this._process.stderr.trim();

        // ignore all content until first "HTTP/" (ie: discard beginning of curl progress info)
        const firstHttpPos = stderr.indexOf('HTTP/');
        if (-1 == firstHttpPos) {
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
            throw new Error(`Missing status line`);
        }
        const status = this._getStatus(statusLine);
        if (undefined === status) {
            throw new Error(`Invalid status line (${statusLine})`);
        }
        this._status = status;

        // headers
        const responseHeaders = {};
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
            if (this._normalizeHeaders) {
                responseHeaders[normalizedName] = value;
            }
            else {
                responseHeaders[name] = value;
            }
        });
        this._responseHeaders = responseHeaders;

        // body
        this._body = this._process.stdout.trim();
        if ('application/json' == this._contentType && this._parseJson) {
            try {
                const body = JSON.parse(this._body);
                this._body = body;
            }
            catch (e) {
                // invalid JSON, do nothing, keep raw body
            }
        }

        this._promise = undefined;
        this._process = undefined;

        if (this._status.code < 200 || this._status.code > 299) {
            if (this._failOnHttpError) {
                return false;
            }
        }

        return true;
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
     * Response headers
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
*                                    Will be ignored if {opt.followRedirects} is {false}
 * @param {string} opt.outputFile if set output will be redirected to this file
 * @param {integer} opt.connectTimeout maximum number of seconds allowed for connection
 * @param {integer} opt.maxTime maximum number of seconds allowed for the transfer
 * @param {object} opt.data data to send as application/x-www-form-urlencoded
 *                          Content type will automatically be set to application/x-www-form-urlencoded
 *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 * @param {object|string|true} opt.json data to send as application/json
 *                                      Content type will automatically be set to application/json
 *                                      Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                                      Will be ignored if {opt.data} was set
 * @param {string|object} opt.file used to upload a file
 *                                 Content type will automatically be set to multipart/form-data
 *                                  Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                                 Will be ignored if one of ({opt.data}, {opt.json}) was set
 *                                 When using a {string}, {opt.file} should be the path of the file to upload
 * @param {string} opt.file.filepath path of the local file (mandatory)
 * @param {string} opt.file.name name of the form parameter (default = {"file"})
 * @param {string} opt.file.filename name of the file (defaults to the name of the local file)
 * @param {string} opt.body body to send
 *                          Will be ignored unless {opt.method} is one of ("PUT", "POST", "DELETE", "PATCH")
 *                          Will be ignored if one of ({opt.data}, {opt.json}, {opt.file}) was set
 * @param {object} opt.params parameters to add as query string
 * @param {boolean} opt.normalizeHeaders if {true}, header names in response will be converted to lower case (default = {true})
 * @param {boolean} opt.parseJson if {true}, automatically parse JSON in responses (default = {true})
 * @param {boolean} opt.failOnHttpError if {true}, {run} method will return {false} in case status code is not in [200, 299] (default = {false})
 * @param {object} opt.basicAuth basic HTTP authentication {"username":"string", "password":"string"}
 * @param {string} opt.bearerToken bearer token to use. Will be ignored if {opt.basicAuth} was set
 *
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

export {
    Curl,
    multiCurl,
    curlRequest
}
