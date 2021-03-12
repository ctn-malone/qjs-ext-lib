import { tester } from '../../src/tester.js';

/*
    Run 3 tests

    - first one is supposed to pass
    - second one is supposed to fail and is async
    - third one is supposed to throw an exception
 */

tester.test('test1', () => {
    tester.assert(true, 'condition is true');
    const obj1 = {a:1,b:[10,20]};
    const obj2 = {a:1,b:[10,20]};
    tester.assertEq(obj1, obj2, `${JSON.stringify(obj1)} == ${JSON.stringify(obj2)}`);
});

tester.test('test2', (done) => {
    tester.assert(false, 'condition is true');
    done();
}, {isAsync:true});

tester.test('test3', () => {
    throw new Error('unexpected error');
});

tester.run();
