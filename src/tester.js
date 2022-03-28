"use strict;"

/*
    Simple unit testing library inspired by https://www.npmjs.com/package/kludjs
 */

/*
    Report verbosity (see {tester.setReportVerbosity})
    This only apply to default reporter
 */
let reportVerbosity = 3;

/*
    Whether or not color should be used in report (see {tester.enableColorInReport})
    This only apply to default reporter
 */
let useColorInReport = true;
const ANSI_COLOR_SUCCESS = '\u001b[38;5;40m';
const ANSI_COLOR_FAILURE = '\u001b[38;5;196m';
const ANSI_COLOR_SKIP = '\u001b[38;5;75m';
const ANSI_COLOR_EXCEPTION = '\u001b[38;5;208m';
const ANSI_COLOR_RESET = '\u001b[0m';

/*
    Whether or not full results should be displayed in case of mismatch (see {tester.displayResultsIfMismatch})
    This only apply to default reporter
 */
let displayResultsIfMismatch = false;

/*
    Various counters about success / failures
 */
const initializeCounters = () => {
    return {
        tests: {passed:0, failed:0, skipped:0},
        assertions: {passed:0, failed:0, exceptions:0},
        currentTest: {didFail:false}
    };
}
let counters = initializeCounters();

/*
    Ensure tests are only run once
 */
let runPromise = undefined;

/**
 * Default report handler
 *
 * @param {string} eventName event name. One of {["begin","end","pass","fail","except","finalize"]}
 * @param {string|undefined} testName test name (`undefined` when `eventName` is `finalize`)
 * @param {object|undefined} assertion only defined when {eventName} is one of {["pass","fail","except"]}
 */
/*
    {assertion} will have following properties

    - if {eventName} is "begin"

        {
            "skip":boolean           // whether or not test will be skipped
        }

    - if {eventName} is "pass"

        {
            "msg":string,            // assertion message
        }

    - if {eventName} is "fail"

        {
            "msg":string,            // assertion message
            "actualResult":any,      // actual result (optional)
            "expectedResult":any     // result which was expected (optional)
            "mismatch":object        // extra information regarding mismatch (optional)
        }

        {mismatch} can contain following promerties :
            - path : (string|int)[], always defined. Example: ['a', 0, 'b'] indicates the path to reach {b} key in below object

                {
                    "a":[
                        {
                            "b":0
                        }
                    ]
                }

            - types : string[2], defined in case of type mismatch
            - values : any[2], defined in case of value mismatch
            - lengths : integer[], defined in case of length mismatch

        {
            "msg":string,            // assertion message
            "unexpectedResult":any   // result we are not supposed to get
        }

    - if {eventName} is "except"

        {
            "msg":string,            // exception message
        }

 */
const defaultReportHandler = (eventName, testName, assertion) => {
    const colors = {pass:'',fail:'',skip:'',except:'',reset:''};
    if (useColorInReport) {
        colors.pass = ANSI_COLOR_SUCCESS;
        colors.fail = ANSI_COLOR_FAILURE;
        colors.skip = ANSI_COLOR_SKIP;
        colors.except = ANSI_COLOR_EXCEPTION;
        colors.reset = ANSI_COLOR_RESET;
    }
    switch (eventName) {
        case 'begin':
            if (reportVerbosity > 1) {
                console.log(`${testName}`);
                if (assertion.skip) {
                    console.log(`  ${colors.skip}skip${colors.reset}`);
                }
            }
            break;
        case 'end':
            break;
        case 'pass':
            if (reportVerbosity > 2) {
                console.log(`  ${colors.pass}ok${colors.reset}: ${assertion.msg}`);
            }
            break;
        case 'fail':
            if (reportVerbosity > 1) {
                console.log(`  ${colors.fail}nok${colors.reset}: ${assertion.msg}`);
                // we have a mismatch context (print it instead)
                if (assertion.hasOwnProperty('mismatch')) {
                    // only print path if mismatch is not related to root value
                    if (0 != assertion.mismatch.path.length) {
                        const path = assertion.mismatch.path.reduce((acc, val) => {
                            if ('number' == typeof val) {
                                if ('' == acc) {
                                    acc = '.';
                                }
                                return `${acc}[${val}]`;
                            }
                            return `${acc}.${val}`;
                        }, '');
                        console.log(`    * path: ${path}`);
                    }
                    if (assertion.mismatch.hasOwnProperty('types')) {
                        console.log(`    * type mismatch`);
                        console.log(`      - actual  : ${assertion.mismatch.types[0]}`);
                        console.log(`      - expected: ${assertion.mismatch.types[1]}`);
                    }
                    if (assertion.mismatch.hasOwnProperty('lengths')) {
                        console.log(`    * length mismatch`);
                        console.log(`      - actual  : ${assertion.mismatch.lengths[0]}`);
                        console.log(`      - expected: ${assertion.mismatch.lengths[1]}`);
                    }
                    if (assertion.mismatch.hasOwnProperty('values')) {
                        console.log(`    * value mismatch`);
                        console.log(`      - actual  : ${JSON.stringify(assertion.mismatch.values[0])}`);
                        console.log(`      - expected: ${JSON.stringify(assertion.mismatch.values[1])}`);
                    }
                    if (!displayResultsIfMismatch) {
                        return;
                    }
                }
                if (assertion.hasOwnProperty('actualResult')) {
                    console.log(`    * results`);
                    console.log(`      - actual  : ${JSON.stringify(assertion.actualResult)}`);
                    if (assertion.hasOwnProperty('expectedResult')) {
                        console.log(`      - expected: ${JSON.stringify(assertion.expectedResult)}`);
                    }
                }
                else if (assertion.hasOwnProperty('unexpectedResult')) {
                    console.log(`    * results`);
                    console.log(`      - unexpected: ${JSON.stringify(assertion.unexpectedResult)}`);
                }
            }
            break;
        case 'except':
            console.log(`  ${colors.except}exception${colors.reset}: ${assertion.msg}`);
            break;
        case 'finalize':
            if (reportVerbosity > 1) {
                console.log('');
            }
            console.log(`[tests] - ${counters.tests.passed > 0 ? colors.pass : colors.reset}passed${colors.reset}: ${counters.tests.passed}  ${counters.tests.failed > 0 ? colors.fail: colors.reset}failed${colors.reset}: ${counters.tests.failed}  ${counters.tests.skipped > 0 ? colors.skip: colors.reset}skipped${colors.reset}: ${counters.tests.skipped}`);
            console.log(`[assertions] - ${counters.assertions.passed > 0 ? colors.pass : colors.reset}passed${colors.reset}: ${counters.assertions.passed}  ${counters.assertions.failed > 0 ? colors.fail: colors.reset}failed${colors.reset}: ${counters.assertions.failed}  ${counters.assertions.exceptions > 0 ? colors.except : colors.reset}exceptions${colors.reset}: ${counters.assertions.exceptions}`);
    }
}
let reportHandler = defaultReportHandler;

/*
    Callback which will be called once all tests have been executed
    An object will be passed as single argument (see example below)

    {
        "success":true,
        "tests":{
            "passed":1,
            "failed":0
        },
        "assertions":{
            "passed":1,
            "failed":0,
            "exceptions":0
        }
    }

 */
let resultHandler = undefined;

/**
 * Test if two items are equal
 *
 * @param {any} a first item
 * @param {any} b second item
 * @param {object} mismatch will be filled with information in case of mismatch
 *
 * @return {boolean}
 */
const _deepEq = (a, b, mismatch) => {
    /*
        {mismatch} will contain following properties
        - path : Array of int|string
        - types : [string, string] defined in case of type mismatch
        - values : [any, any] defined in case of value mismatch
        - lengths : [integer, integer] defined in case of length mismatch
     */
    if (undefined === mismatch.path) {
        mismatch.path = [];
    }
    if (null === a) {
        if (null !== b) {
            mismatch.types = ['null', typeof b];
            return false;
        }
        return true;
    }
    else if (null === b) {
        if (null !== a) {
            mismatch.types = [typeof a, 'null'];
            return false;
        }
        // already checked above
    }
    if (typeof a !== typeof b) {
        mismatch.types = [typeof a, typeof b];
        return false;
    }
    if (a instanceof Function) {
        if (a.toString() === b.toString()) {
            return true;
        }
        mismatch.values = [a.toString(), b.toString()];
        return false;
    }
    if (a === b || a.valueOf() === b.valueOf()) {
        return true;
    }
    if (!(a instanceof Object)) {
        mismatch.values = [a, b];
        return false;
    }
    const ka = Object.keys(a);
    if (ka.length != Object.keys(b).length) {
        mismatch.lengths = [ka.length, Object.keys(b).length];
        return false;
    }
    for (let k in b) {
        if (!b.hasOwnProperty(k)) {
            continue;
        }
        let key = k;
        if (Array.isArray(a)) {
            key = parseInt(k);
        }
        if (ka.indexOf(k) === -1) {
            mismatch.values = [undefined, b[k]];
            mismatch.path.push(key);
            return false;
        }
        // save path & use a temporary one
        const path = mismatch.path;
        mismatch.path = [key];
        if (!_deepEq(a[k], b[k], mismatch)) {
            /*
                mismatch object has been updated during recursive call
                just update {path} using saved value
             */
            for (let i = 0; i < mismatch.path.length; ++i) {
                path.push(mismatch.path[i]);
            }
            mismatch.path = path;
            return false;
        }
        // restore path
        mismatch.path = path;
    }
    return true;
}

/**
 * Reset a mismatch context
 *
 * @param {object} obj
 */
const resetMismatch = (obj) => {
    const keys = Object.keys(obj);
    for (let k = 0; k < keys.length; ++k) {
        delete obj[k];
    }
}

/**
 * Ensure a condition is {true}
 *
 * @param {string} testName test name
 * @param {boolean} cond
 * @param {string} msg message to display
 * @param {object} opt options
 * @param {any} opt.actualResult if defined, will be displayed in case of failure
 * @param {any} opt.expectedResult if defined, will be displayed in case of failure
 */
const _assert = (testName, cond, msg, opt) => {
    cond = !!cond;
    if (cond) {
        // update counters
        ++counters.assertions.passed;
        reportHandler('pass', testName, {msg:msg});
    } else {
        // update counters
        counters.currentTest.didFail = true;
        ++counters.assertions.failed;
        if (undefined === opt) {
            opt = {};
        }
        const assertion = {msg:msg};
        if (opt.hasOwnProperty('actualResult')) {
            assertion.actualResult = opt.actualResult;
        }
        if (opt.hasOwnProperty('expectedResult')) {
            assertion.expectedResult = opt.expectedResult;
        }
        reportHandler('fail', testName, assertion);
    }
};

/**
 * Ensure two items are equal
 *
 * @param {string} testName test name
 * @param {any} actualResult actual result
 * @param {any} expectedResult expected result
 * @param {string} msg message to display
 */
const _assertEq = (testName, actualResult, expectedResult, msg) => {
    const mismatch = {};
    const result = _deepEq(actualResult, expectedResult, mismatch);
    if (result) {
        // update counters
        ++counters.assertions.passed;
        reportHandler('pass', testName, {msg:msg});
    } else {
        // update counters
        counters.currentTest.didFail = true;
        ++counters.assertions.failed;
        reportHandler('fail', testName, {msg:msg, actualResult:actualResult, expectedResult:expectedResult, mismatch:mismatch});
    }
};

/**
 * Ensure two items are not equal
 *
 * @param {string} testName test name
 * @param {any} actualResult actual result
 * @param {any} unexpectedResult the result we are not supposed to get
 * @param {string} msg message to display
 */
const _assertNeq = (testName, actualResult, unexpectedResult, msg) => {
    const result = !_deepEq(actualResult, unexpectedResult, {});
    if (result) {
        // update counters
        ++counters.assertions.passed;
        reportHandler('pass', testName, {msg:msg});
    } else {
        // update counters
        counters.currentTest.didFail = true;
        ++counters.assertions.failed;
        reportHandler('fail', testName, {msg:msg, unexpectedResult:unexpectedResult});
    }
};

/**
 * Called when exception is thrown in a test
 *
 * @param {string} testName test name
 * @param {string|Error} error exception or message
 */
const handleException = (testName, error) => {
    let errorMsg = '';
    if (undefined !== error.message) {
        errorMsg = error.message.trim();
        if (undefined !== error.stack) {
            errorMsg += `\n${error.stack.trimEnd()}`;
        }
    }
    else if ('string' == typeof error) {
        errorMsg = error.trim();
    }
    else {
        errorMsg = JSON.stringify(error);
    }
    // update counters
    counters.currentTest.didFail = true;
    ++counters.assertions.exceptions;
    reportHandler('except', testName, {msg:errorMsg});
}

const pendingTests = [];

// name of current test
let currentTest;

// whether or not we should stop on first failure
let stopOnFailure = false;

const tester = {
    /**
     * Ensure a condition is {true}
     *
     * @param {boolean} cond
     * @param {string} msg message to display
     * @param {object} opt options
     * @param {any} opt.actualResult if defined, will be displayed in case of failure
     * @param {any} opt.expectedResult if defined, will be displayed in case of failure
     */
    assert:(cond, msg, opt) => {
        if (counters.currentTest.didFail && stopOnFailure) {
            return;
        }
        _assert(currentTest, cond, msg, opt);
    },

    /**
     * Test if two items are equal
     *
     * @param {any} a first item
     * @param {any} b second item
     * @param {object} mismatch will be filled with information in case of mismatch (optional)
     *
     * @return {boolean}
     */
    eq: (a, b, mismatch) => {
        if (undefined === mismatch) {
            mismatch = {};
        }
        else {
            if ('object' != typeof mismatch) {
                throw new TypeError(`Argument 'mismatch' should be an object`)
            }
            resetMismatch(mismatch);
        }
        return _deepEq(a, b, mismatch);
    },

    /**
     * Ensure two items are equal
     *
     * @param {any} actualResult actual result
     * @param {any} expectedResult expected result
     * @param {string} msg message to display
     */
    assertEq: (actualResult, expectedResult, msg) => {
        if (counters.currentTest.didFail && stopOnFailure) {
            return;
        }
        _assertEq(currentTest, actualResult, expectedResult, msg);
    },

    /**
     * Ensure two items are not equal
     *
     * @param {any} actualResult actual result
     * @param {any} unexpectedResult the result we are not supposed to get
     * @param {string} msg message to display
     */
    assertNeq: (actualResult, unexpectedResult, msg) => {
        if (counters.currentTest.didFail && stopOnFailure) {
            return;
        }
        _assertNeq(currentTest, actualResult, unexpectedResult, msg);
    },

    /**
     * Register a test
     *
     * @param {string} testName test name
     * @param {function} fn test function
     * @param {object} opt options
     * @param {boolean} opt.isAsync whether or not test is async (default = {false})
     * @param {string[]|string} opt.tags tags to assign to this test
     * @param {boolean|function} opt.skip whether or not test should be skipped (default = {false})
     * @param {integer} opt.repeat number of times test should be repeated (default = 1)
     */
    test: (testName, fn, opt) => {
        if (undefined === opt) {
            opt = {};
        }

        const _isAsync = (true === opt.isAsync);
        
        // whether or not test should be skipped
        let skipFn = () => { return false };
        if (undefined !== opt.skip) {
            if (true === opt.skip || false === opt.skip) {
                skipFn = () => { return opt.skip };
            }
            else if ('function' == typeof opt.skip) {
                skipFn = opt.skip;
            }
        }

        // check tags
        let tags = [];
        if (undefined !== opt.tags) {
            if ('string' == typeof opt.tags && '' != opt.tags) {
                tags = [opt.tags];
            }
            else if (Array.isArray(opt.tags)) {
                tags = [...opt.tags];
            }
        }

        /*
            Create a new function which returns a promise
         */
        const _fn = (skip) => {
            if (skip) {
                return new Promise((resolve) => {
                    resolve();
                });
            }
            // fn is not async
            if (!_isAsync) {
                return new Promise((resolve) => {
                    try {
                        fn();
                    }
                    catch (e) {
                        handleException(currentTest, e);
                    }
                    resolve();
                });
            }
            // fn is async
            return new Promise((resolve) => {
                try {
                    const p = fn(resolve);
                    // is it a promise ?
                    if (p instanceof Promise) {
                        p.catch((e) => {
                            handleException(currentTest, e)
                            resolve();
                        });
                    }
                }
                catch (e) {
                    handleException(currentTest, e);
                    resolve();
                }
            });
        }
        let repeat = 1;
        if (undefined !== opt.repeat) {
            const value = parseInt(opt.repeat);
            if (!isNaN(value) && value > 0) {
                repeat = value;
            }
        }
        for (let i = 0; i < repeat; ++i) {
            pendingTests.push({name:testName, fn:_fn, skipFn:skipFn, tags:tags});
        }
    },

    /**
     * Run all tests
     *
     * @param {object} opt options
     * @param {boolean} opt.stopOnFailure if {true}, method will stop after first failed assertion
     * @param {string|strings} opt.tags only run tests with a given tag
     *
     * @return {Promise} which will resolve to an object (see {resultHandler} definition at the top of the file)
     */
    run: (opt) => {
        if (undefined !== runPromise) {
            return runPromise;
        }
        // reset counters
        counters = initializeCounters();
        if (undefined === opt) {
            opt = {};
        }
        stopOnFailure = (true === opt.stopOnFailure);
        runPromise = new Promise(async (resolve) => {
            // check tags
            let tags = [];
            if (undefined !== opt.tags) {
                if ('string' == typeof opt.tags && '' != opt.tags) {
                    tags = [opt.tags];
                }
                else if (Array.isArray(opt.tags)) {
                    tags = [...opt.tags];
                }
            }

            let tests = pendingTests;

            // filter by tags
            if (0 != tags.length) {
                tests = [];
                pendingTests.forEach((item) => {
                    for (let i = 0; i < tags.length; ++i) {
                        if (item.tags.includes(tags[i])) {
                            tests.push(item);
                            return;
                        }
                    }
                });
            }

            // run tests
            for (let i = 0; i < tests.length; ++i) {
                // reset env
                currentTest = tests[i].name;
                counters.currentTest.didFail = false;

                // run test
                let skip = false;
                try {
                    skip = tests[i].skipFn();
                }
                catch (e) {
                    // nothing to do
                }
                reportHandler('begin', currentTest, {skip:skip});
                await pendingTests[i].fn(skip);
                reportHandler('end', currentTest);

                // update counters
                if (skip) {
                    ++counters.tests.skipped;
                }
                else if (counters.currentTest.didFail) {
                    ++counters.tests.failed;
                }
                else {
                    ++counters.tests.passed;
                }
                // check if we need to stop in case of failure
                if (counters.currentTest.didFail) {
                    if (stopOnFailure) {
                        break;
                    }
                }
            }
            reportHandler('finalize');
            const result = {
                success:true,
                tests:counters.tests,
                assertions:counters.assertions
            };
            if (0 != result.tests.failed) {
                result.success = false;
            }
            if (undefined !== resultHandler) {
                resultHandler(result);
            }
            runPromise = undefined;
            resolve(result);
        });
        return runPromise;
    },

    /**
     * Set verbosity level for reporting
     *
     * This only apply to default reporter
     *
     * @param {integer} level (default = 3)
     *                    - 3 (default) : print test name, all assertions & final summary
     *                    - 2: only print test name, failed assertions & final summary
     *                    - 1: only print final summary
     */
    setReportVerbosity: (level) => {
        const value = parseInt(level);
        if (!isNaN(value)) {
            switch (value) {
                case 4:
                case 3:
                case 2:
                case 1:
                    reportVerbosity = value;
                    break;
            }
        }
    },

    /**
     * Configure whether or not report should use color
     *
     * This only apply to default reporter
     *
     * @param {boolean} flag
     */
    enableColorInReport: (flag) => {
        useColorInReport = (true === flag);
    },

    /**
     * Configure whether or not full results should be displayed
     * in case of mismatch (ie: when calling {assertEq})
     *
     * This only apply to default reporter
     *
     * @param {boolean} flag
     */
    displayResultsIfMismatch: (flag) => {
        displayResultsIfMismatch = (true === flag);
    },

    /**
     * Define a new report handler
     *
     * @param {function} fn new handler
     */
    setReportHandler: (fn) => {
        if ('function' == typeof fn) {
            reportHandler = fn;
        }
    },

    /**
     * Define a new result handler (called once all tests have been executed)
     *
     * @param {function} fn new handler
     */
    setResultHandler: (fn) => {
        if ('function' == typeof fn) {
            resultHandler = fn;
        }
    }

};

export {
    tester
}
