# tester

Minimal unit testing library

## tester.test(...)

`tester.test(testName, fn, opt)`

Defines a new test

* **[testName]** (*string*) : name/description of the test
* **[fn]** (*function*) : test function
* opt (*object*) : options
  * opt.isAsync (*boolean*) : whether or not test is async (default = `false`)
  * opt.tags (*string|string[]*) : tags to assign to the test (can be used to filter which tests will be run)
  * opt.skip (*boolean|function*) : whether or not test should be skipped (default =`false`)
                                    When using a `function`, it should return a `boolean`

When a test function is *async*, a callback will be passed to the test function and should be called to indicate that test is complete

<u>Example</u>

```js
tester.test('test1', () => {
    tester.assert(true, 'condition is true');
});
tester.test('test2', (done) => {
    os.setTimeout(() => {
        tester.assert(false, 'assertion failed');
        done();
    }, 1000);
}, {
    isAsync:true,
    skip:() => {
        return (0 == Date.now() % 2);
    }
});
await tester.run();
```

## tester.assert(...)

`tester.assert(cond, msg, opt)`

Expects a condition to be `true`

* **[cond]** (*boolean*) : condition to check
* **[msg]** (*string*) : message to display
* opt (*object*) : options
  * opt.actualResult (*any*) : if defined, will be displayed in case of failure
  * opt.expectedResult (*any*) : if defined, will be displayed in case of failure

<u>Examples</u>

```js
tester.test('test1', () => {
    const condition = (Math.random() < 0.5);
    tester.assert(condition, 'condition is true');
});
await tester.run();
```

```js
tester.test('test2', () => {
    const number = Math.random();
    const condition = number < 0.5;
    tester.assert(condition, 'number should be < 0.5', {actualResult:number});
});
await tester.run();
```

## tester.assertEq(...)

`tester.assertEq(actualResult, expectedResult, msg)`

Expects two items to be equals (deep object comparison)

* **[actualResult]** (*any*) : result to compare
* **[expectedResult]** (*any*) : result which is expected
* **[msg]** (*string*) : message to display

<u>Example</u>

```js
tester.test('test1', () => {
    const obj1 = {a:1, b:[1,2,3]};
    const obj2 = {a:1, b:[1,2,3]};
    tester.assertEq(obj2, obj1, 'objects should be equal');
});
await tester.run();
```

## tester.assertNeq(...)

`tester.assertNeq(actualResult, unexpectedResult, msg)`

Expects two items to be distinct (deep object comparison)

* **[actualResult]** (*any*) : result to compare
* **[unexpectedResult]** (*any*) : result which we are not supposed to get
* **[msg]** (*string*) : message to display

<u>Example</u>

```js
tester.test('test1', () => {
    const obj1 = {a:1, b:[1,2,3]};
    const obj2 = {a:1, b:[1,3,2]};
    tester.assertNeq(obj2, obj1, 'objects should be distinct');
});
await tester.run();
```

## tester.eq(...)

`tester.eq(a, b, mismatch)`

Checks whether or not two items are equal (deep object comparison)

* **[a]** (*any*) : first item
* **[b]** (*any*) : second item
* mismatch (*object*) will be filled with information in case of mismatch

**return** *boolean*

## tester.run(...)

`tester.run()`

Run tests

* opt (*object*) : options
  * opt.stopOnFailure (*boolean*) : if `true` stop after first failed assertion (default = `false`)
  * opt.tags (*string|string[]*) : only run tests matching at least one of the tags

**return** *Promise* which resolves to an *object* with following properties

* success (*boolean*) : whether or not all assertions succeeded
* tests (*object*)
  * passed (*integer*) : number of tests which passed
  * failed (*integer*) : number of tests which failed
  * skipped (*integer*) : number of tests which were skipped
* assertions (*object*)
  * passed (*integer*) : number of assertions which passed
  * failed (*integer*) : number of assertions which failed
  * exceptions (*integer*) : number of exceptions which were thrown

<u>Example</u>

```js
tester.test('test1', () => {
    // will be run
    tester.assert(true, 'condition is true');
}, {tags:['myTag1']});
tester.test('test2', (done) => {
    // will be run
    tester.assert(true, 'condition is true');
}, {tags:['myTag2']});
tester.test('test3', (done) => {
    // will not be run
    tester.assert(true, 'condition is true');
}, {tags:['myTag3']});
await tester.run({tags:['myTag1','myTag2']});
```

## tester.setReportVerbosity(...)

`tester.setReportVerbosity(level)`

Change report verbosity. This only apply to *default reporter*

* **[level]** (*integer*) : define report verbosity (default = `3`). Can be one of the following :
  * `3` (*default*) : print test name, all assertions and final summary
  * `2` : only print test name, failed assertions and final summary
  * `1` : only print final summary

<u>Example</u>

```js
tester.test('test1', () => {
    tester.assert(true, 'condition is true');
});
tester.test('test2', () => {
    tester.assert(false, 'assertion failed');
});
tester.setReportVerbosity(2);
await tester.run();
```

## tester.enableColorInReport(...)

`tester.enableColorInReport(flag)`

Enable / disable color in report. This only apply to *default reporter*

* **[flag]** (*boolean*) : if `true`, color will be enabled (default = `true`)

<u>Example</u>

```js
tester.test('test1', () => {
    tester.assert(true, 'condition is true');
});
tester.enableColorInReport(false);
await tester.run();
```

## tester.setReportHandler(...)

`tester.setReportHandler(fn)`

Defines a custom reporter

* **[fn]** (*function*) : reporting function

Following arguments will be passed to the function

* eventName (*string*) : name of the event. Can be one of
  * `begin` : triggered before a test is run
  * `end` : triggered after a test has been run
  * `pass` : triggered when an assertion is `true`
  * `fail` : triggered when an assertion failed
  * `except` : triggered when an exception has been triggered by a test
  * `finalize` : triggered after all tests have been run
* testName (*string*) : name of current test (`undefined` when `eventName` is `finalize`)
* assertion (*object*) : only defined when `eventName` is one of `["pass","fail","except"]`

`assertion` object will have following properties

* if `eventName` is `begin`
  * skip (*boolean*) : whether or not test will be skipped
* if `eventName` is `pass`
  * msg (*string*)
* if `eventName` is `fail`
  * when triggered from `assert`
    * msg (*string*) : assertion message
    * actualResult (*any*) : result which triggered the failure (only if `opt.actualResult` was defined)
    * expectedResult (*any*) : result which was expected (only if `opt.expectedResult` was defined)
  * when triggered from `assertEq`
    * msg (*string*) : assertion message
    * actualResult (*any*)
    * expectedResult (*any*)
    * mismatch (*object*)
      * mismatch.path (*[string|integer, string|integer, ...]*) : path of the mismatch key (will be empty for a *top-level* value)
      * mismatch.types (*[string, string]*) : defined in case of type mismatch
      * mismatch.lengths (*[integer, integer]*) : defined in case of length mismatch
      * mismatch.values (*[any, any]*) : defined in case of value mismatch
  * when triggered from `assertNeq`
    * msg (*string*) : assertion message
    * unexpectedResult (*any*)
* if `eventName` is `except` 
  * msg (*string*) : exception message

<u>Example</u>

```js
tester.test('test1', () => {
    tester.assert(true, 'condition is true');
});
tester.test('test2', () => {
    tester.assert(false, 'assertion failed');
});
tester.test('test3', () => {
    throw new Error('Damnit !')
});
tester.setReportHandler((eventName, testName, assertion) => {
    switch (eventName) {
        case 'begin':
        case 'end':
            console.log(`${eventName} (${testName})`);
            return;
        case 'pass':
        case 'fail':
        case 'except':
            console.log(`${eventName} (${testName}): ${assertion.msg}`);
            return;
    }
    console.log('Done !');
});
await tester.run();
```

## tester.setResultHandler(...)

`setResultHandler(fn)`

Defines a callback which will be called once all tests have been run

* **[fn]** (*function*) : callback

An *object* will be passed as a single argument to the callback. See `run` method result
