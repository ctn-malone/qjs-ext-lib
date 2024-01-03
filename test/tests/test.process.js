import * as os from 'os';
import * as std from 'std';
import { tester } from '../../src/tester.js';
import { Process, exec, waitpid, ProcessSync, execSync } from '../../src/process.js';

export default () => {

    tester.test('process.Process (props)', () => {
        const props = {cmd:'date'};
        const p = new Process('date', {
            props:props
        });
        tester.assertEq(p.props, props, `{props} should match`);
    });

    tester.test('process.Process with stdout/stderr handlers', async (done) => {
        const opt = {trim:false};
        const cmdline = 'data/test1.sh 10';
        const p = new Process(cmdline, opt);
        const stdoutLines = [];
        const stderrLines = [];
        let stateFromEvent;
        let expectedContent, content, match;
        p.setEventListener('stdout', (obj) => {
            stdoutLines.push(obj.data);
        });
        p.setEventListener('stderr', (obj) => {
            stderrLines.push(obj.data);
        });
        p.setEventListener('exit', (state) => {
            stateFromEvent = state;
        });
        const state = await p.run();
        tester.assertEq(state.exitCode, 0, `{state.exitCode} should be 0`);
        tester.assert(false === state.didTimeout, `{state.didTimeout} should be false`);
        tester.assertEq(state.signal, undefined, `{state.signal} should be undefined`);
        tester.assertEq(state, stateFromEvent, `{state} return by 'run' method should match {state} received in 'exit' handler`);

        expectedContent = `2\n4\n6\n8\n10\n`;
        content = stdoutLines.join('');
        tester.assertEq(content, expectedContent, `'stdout' content computed using 'stdout' handler should be as expected`);
        tester.assertEq(p.stdout, '', `'stdout' content retrieved using 'stdout' property should be empty`);

        expectedContent = `1\n3\n5\n7\n9\n`;
        content = stderrLines.join('');
        tester.assertEq(content, expectedContent, `'stderr' content computed using 'stderr' handler should be as expected`);
        tester.assertEq(p.stderr, '', `'stderr' content retrieved using 'stderr' property should be empty (${JSON.stringify(p.stderr)})`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (with stdout handler only)', async (done) => {
        const opt = {trim:false};
        const cmdline = 'data/test1.sh 10';
        const p = new Process(cmdline, opt);
        const stdoutLines = [];
        let expectedContent, content, match;
        p.setEventListener('stdout', (obj) => {
            stdoutLines.push(obj.data);
        });
        await p.run();

        expectedContent = `2\n4\n6\n8\n10\n`;
        content = stdoutLines.join('');
        tester.assertEq(content, expectedContent, `'stdout' content computed using 'stdout' handler should be be as expected`);
        tester.assertEq(p.stdout, '', `'stdout' content retrieved using 'stdout' property should be empty (${JSON.stringify(p.stdout)})`);

        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `'stderr' content retrieved using 'stderr' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (with stderr handler only)', async (done) => {
        const opt = {trim:false};
        const cmdline = 'data/test1.sh 10';
        const p = new Process(cmdline, opt);
        const stderrLines = [];
        let expectedContent, content;
        p.setEventListener('stderr', (obj) => {
            stderrLines.push(obj.data);
        });
        await p.run();

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);

        expectedContent = `1\n3\n5\n7\n9\n`;
        content = stderrLines.join('');
        tester.assertEq(content, expectedContent, `'stderr' content computed using 'stderr' handler should be as expected`);
        tester.assertEq(p.stderr, '', `'stderr' content retrieved using 'stderr' property should be empty`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (without stdout/stderr handlers)', async (done) => {
        const opt = {trim:false};
        const cmdline = 'data/test1.sh 10';
        let expectedContent;
        const p = new Process(cmdline, opt);
        await p.run();

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);

        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `'stderr' content retrieved using 'stderr' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (with stderr redirected to stdout)', async (done) => {
        const opt = {trim:false, redirectStderr: true};
        const cmdline = 'data/test1.sh 10';
        const p = new Process(cmdline, opt);
        let expectedContent;
        await p.run();

        expectedContent = `1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (line buffering)', async (done) => {
        let opt, cmdline, p;
        let stdoutLines, stderrLines;
        let expectedContent, content;

        /*
            without line buffering
         */
        opt = {trim:false, lineBuffered:false};
        cmdline = 'data/test2.sh 10';
        p = new Process(cmdline, opt);
        stdoutLines = [];
        stderrLines = [];
        p.setEventListener('stdout', (obj) => {
            stdoutLines.push(obj.data);
        });
        p.setEventListener('stderr', (obj) => {
            stderrLines.push(obj.data);
        });
        await p.run();

        expectedContent = `246810\n`;
        content = stdoutLines.join('');
        tester.assertEq(content, expectedContent, `without line buffering, 'stdout' content computed using 'stdout' handler should be as expected`);
        tester.assert(stdoutLines.length > 1, `without line buffering, 'stdout' handler should have been called more than once (${stdoutLines.length})`);

        expectedContent = `13579\n`;
        content = stderrLines.join('');
        tester.assertEq(content, expectedContent, `without line buffering, 'stderr' content computed using 'stderr' handler should be ${JSON.stringify(expectedContent)} (${JSON.stringify(content)})`);
        tester.assert(stderrLines.length > 1, `without line buffering, 'stderr' handler should have been called more than once (${stderrLines.length})`);

        /*
            with line buffering
         */
        opt = {trim:false, lineBuffered:true};
        cmdline = 'data/test2.sh 10';
        p = new Process(cmdline, opt);
        stdoutLines = [];
        stderrLines = [];
        p.setEventListener('stdout', (obj) => {
            stdoutLines.push(obj.data);
        });
        p.setEventListener('stderr', (obj) => {
            stderrLines.push(obj.data);
        });
        await p.run();

        expectedContent = `246810`;
        content = stdoutLines.join('');
        tester.assertEq(content, expectedContent, `with line buffering, 'stdout' content computed using 'stdout' handler should be as expected`);
        tester.assert(1 == stdoutLines.length, `with line buffering, 'stdout' handler should have been called only once (${stdoutLines.length})`);

        expectedContent = `13579`;
        content = stderrLines.join('');
        tester.assertEq(content, expectedContent, `with line buffering, 'stderr' content computed using 'stderr' handler should be as expected`);
        tester.assert(1 == stderrLines.length, `with line buffering, 'stderr' handler should have been called only once (${stderrLines.length})`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (trimming)', async (done) => {
        let opt, cmdline, p;
        let expectedContent;

        /*
            without trimming
         */
        opt = {trim:false};
        cmdline = 'data/test3.sh 10';
        p = new Process(cmdline, opt);
        await p.run();

        expectedContent = `\n\n   2\n4\n6\n8\n10\n\n\n   `;
        tester.assertEq(p.stdout, expectedContent, `without trimming 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `\n\n   1\n3\n5\n7\n9\n\n\n   `;
        tester.assertEq(p.stderr, expectedContent, `without trimming 'stderr' content retrieved using 'stderr' property should be as expected`);

        /*
            with trimming
         */
        opt = {trim:true};
        cmdline = 'data/test3.sh 10';
        p = new Process(cmdline, opt);
        await p.run();

        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(p.stdout, expectedContent, `with trimming 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n3\n5\n7\n9`;
        tester.assertEq(p.stderr, expectedContent, `with trimming 'stderr' content retrieved using 'stderr' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (skip blank lines)', async (done) => {
        let opt, cmdline, p;
        let expectedContent;

        /*
            without skipping blank lines
         */
        opt = {trim:false,skipBlankLines:false};
        cmdline = 'data/test4.sh 10';
        p = new Process(cmdline, opt);
        await p.run();

        expectedContent = `2\n\n4\n\n6\n\n8\n\n10\n\n`;
        tester.assertEq(p.stdout, expectedContent, `without skipping blank lines 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n\n3\n\n5\n\n7\n\n9\n\n`;
        tester.assertEq(p.stderr, expectedContent, `without skipping blank lines 'stderr' content retrieved using 'stderr' property should be as expected`);

        /*
            when skipping blank lines
         */
        opt = {trim:false,skipBlankLines:true};
        cmdline = 'data/test4.sh 10';
        p = new Process(cmdline, opt);
        await p.run();

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `when skipping blank lines 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `when skipping blank lines 'stderr' content retrieved using 'stderr' property should be as expected`);

        done();

    }, {isAsync:true});

    tester.test('process.Process (custom stdout)', async (done) => {
        const tmpFile = std.tmpfile();
        // redirect stderr will be ignored
        const opt = {trim:false, redirectStderr: true, stdout: tmpFile.fileno()};
        const cmdline = 'data/test1.sh 10';
        const p = new Process(cmdline, opt);
        let expectedContent;
        await p.run();

        const stdoutContent = tmpFile.readAsString();

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(stdoutContent, expectedContent, `when using custom 'stdout' handle, content retrieved using by reading temp file should be as expected`);
        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `when using custom 'stdout' handle, content retrieved using 'stderr' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (env)', async (done) => {
        let opt, cmdline, p;
        let expectedContent;
        let newEnv;

        /*
            variables should not be defined
         */
        opt = {trim:false};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        p = new Process(cmdline, opt);
        await p.run();
        expectedContent = `DUMMY_VAR1=\nDUMMY_VAR2=\n`;
        tester.assertEq(p.stdout, expectedContent, `without defining variables in parent, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            variable DUMMY_VAR1 should be defined
         */
        opt = {trim:false};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new Process(cmdline, opt);
        await p.run();
        expectedContent = `DUMMY_VAR1=1\nDUMMY_VAR2=\n`;
        tester.assertEq(p.stdout, expectedContent, `when defining DUMMY_VAR1 in parent, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            variable DUMMY_VAR2 should be defined, but not variable DUMMY_VAR1 when child env is replaced
         */
        newEnv = {'DUMMY_VAR2':'2'};
        opt = {trim:false, replaceEnv:true, env:newEnv};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new Process(cmdline, opt);
        await p.run();
        expectedContent = `DUMMY_VAR1=\nDUMMY_VAR2=2\n`;
        tester.assertEq(p.stdout, expectedContent, `when replacing child env with ${JSON.stringify(newEnv)}, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            both variables should be defined when child env is updated instead of being replaced
         */
        newEnv = {'DUMMY_VAR2':'2'};
        opt = {trim:false, replaceEnv:false, env:newEnv};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new Process(cmdline, opt);
        await p.run();
        expectedContent = `DUMMY_VAR1=1\nDUMMY_VAR2=2\n`;
        tester.assertEq(p.stdout, expectedContent, `when updating child env with ${JSON.stringify(newEnv)}, 'stdout' content retrieved using 'stdout' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (use shell)', async (done) => {
        let opt, cmdline, p;
        let expectedContent;
        let state;

        /*
            process should fail
         */
        opt = {trim:false, useShell:false};
        cmdline = 'a=1 ; echo $a';
        p = new Process(cmdline, opt);
        state = await p.run();
        tester.assert(0 != state.exitCode, `when executing ${JSON.stringify(cmdline)} without shell, exit code should be != 0 (${JSON.stringify(state)})`);
        tester.assert(!p.success, `when executing ${JSON.stringify(cmdline)} without shell, .success should be false (${JSON.stringify(state)})`);

        /*
            process should not fail
         */
        opt = {trim:false, useShell:true};
        cmdline = 'a=1 ; echo $a';
        p = new Process(cmdline, opt);
        state = await p.run();
        tester.assert(0 == state.exitCode, `when executing ${JSON.stringify(cmdline)} with shell, exit code should be 0 (${JSON.stringify(state)})`);
        tester.assert(p.success, `when executing ${JSON.stringify(cmdline)} with shell, .success should be true (${JSON.stringify(state)})`);
        expectedContent = "1\n";
        tester.assertEq(p.stdout, expectedContent, `when executing ${JSON.stringify(cmdline)} with shell, 'stdout' content retrieved using 'stdout' property should be as expected`);
        done();

    }, {isAsync:true});

    tester.test('process.Process (use path)', async (done) => {
        let opt, cmdline, p;
        let state;

        /*
            process should fail
         */
        opt = {trim:false, usePath:false};
        cmdline = 'script_which_does_not_exist_in_path.sh';
        p = new Process(cmdline, opt);
        state = await p.run();
        tester.assert(0 != state.exitCode, `when executing ${JSON.stringify(cmdline)} without using PATH, process should fail (${JSON.stringify(state)})`);

        /*
            process should not fail
         */
        opt = {trim:false, usePath:true};
        cmdline = 'script_which_does_not_exist_in_path.sh';
        const path = std.getenv('PATH')
        std.setenv('PATH', `data:${path}`);
        p = new Process(cmdline, opt);
        state = await p.run();
        std.setenv('PATH', `${path}`);
        tester.assert(0 == state.exitCode, `when executing ${JSON.stringify(cmdline)} using PATH, process should not fail (${JSON.stringify(state)})`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (pause/resume)', async (done) => {
        let opt, cmdline, p;
        let stdoutLines = [];
        let content, finalContent;

        opt = {lineBuffered:true};
        cmdline = 'data/test6.sh 10';
        p = new Process(cmdline, opt);
        finalContent = '12345678910';
        p.setEventListener('stdout', (obj) => {
            stdoutLines.push(obj.data);
            /*
                pause child upon receiving first line
             */
            if (1 == stdoutLines.length) {
                p.pause();
                const pausedContent = stdoutLines.join('');
                tester.assertNeq(pausedContent, finalContent, `when child is paused, 'stdout' content should be distinct from final content`);
                tester.assert(p.paused, `when child is paused, {pause} property should be {true}`);

                /*
                    resume child after 1s
                 */
                os.setTimeout(() => {
                    const content = stdoutLines.join('');
                    tester.assertEq(content, pausedContent, `1s after pausing child, 'stdout' content should still be the same`);
                    p.resume();
                    tester.assert(!p.paused, `when child is resumed, {pause} property should be {false}`);
                }, 1000);
            }
        });
        await p.run();
        content = stdoutLines.join('');
        tester.assertEq(content, finalContent, `after child termination, 'stdout' content should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (kill)', async (done) => {
        let opt, cmdline, p;
        let state;

        opt = {lineBuffered:true};
        cmdline = 'data/test6.sh 30';
        p = new Process(cmdline, opt);
        /*
            kill child after 1s
         */
        os.setTimeout(() => {
            p.kill();
        }, 1000);
        state = await p.run();
        const expectedExitCode = -15;
        const expectedSignal = 'SIGTERM';
        tester.assertEq(state.exitCode, expectedExitCode, `when killing child process, exitCode should be as expected`);
        tester.assertEq(state.signal, expectedSignal, `when killing child process, signal should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (timeout)', async (done) => {
        let opt, cmdline, p;
        let state;

        opt = {lineBuffered:true, timeout:1, timeoutSignal:os.SIGABRT};
        cmdline = 'data/test9.sh';
        p = new Process(cmdline, opt);
        const tsStart = Date.now();
        state = await p.run();
        const tsEnd = Date.now();
        const tsDelta = tsEnd - tsStart;
        const expectedExitCode = -opt.timeoutSignal;
        const expectedSignal = 'SIGABRT';
        tester.assertEq(state.exitCode, expectedExitCode, `when setting a 1s timeout for child process, exitCode should be as expected`);
        tester.assertEq(state.signal, expectedSignal, `when setting a 1s timeout for child process, signal should be as expected`);
        // timeout seems to take ~ 1.5 extra second
        tester.assert(tsDelta >= 1000 && tsDelta <= 2500, `when setting a 1s timeout for child process, process should exit after =~ 1000ms (${JSON.stringify(tsDelta)})`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (stdin redirect)', async (done) => {
        let opt, cmdline, p;
        let state;

        // load input
        const inputFile = 'data/input1.txt';
        const input = std.loadFile(inputFile).trim();
        const tmpFile = std.tmpfile();
        tmpFile.puts(input);
        tmpFile.flush();
        // rewind
        tmpFile.seek(0);

        const expectedContent = input.split("\n").map(line => `[in] ${line}`).join("\n");

        cmdline = 'data/test9.sh';
        opt = {stdin:tmpFile.fileno(), timeout:5};
        p = new Process(cmdline, opt);
        state = await p.run();

        // tmp file can now be closed
        tmpFile.close();

        tester.assertEq(p.stdout, expectedContent, `when redirecting 'stdin', 'stdout' content retrieved using 'stdout' property should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.Process (with input)', async (done) => {
        let opt, cmdline, p;
        let state;

        // load input
        const inputFile = 'data/input1.txt';
        const input = std.loadFile(inputFile).trim();

        const expectedContent = input.split("\n").map(line => `[in] ${line}`).join("\n");

        cmdline = 'data/test9.sh';
        opt = {input: input, timeout:5};
        p = new Process(cmdline, opt);
        state = await p.run();

        tester.assertEq(p.stdout, expectedContent, `when passing 'input', 'stdout' content retrieved using 'stdout' property should be as expected`);

        done();
    }, {isAsync:true});    

    tester.test('process.exec', async (done) => {
        let opt, cmdline;
        let expectedContent, content;

        /*
            process did not fail
         */
        opt = {trim:true};
        cmdline = 'data/test1.sh 10';
        content = await exec(cmdline, opt);
        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(content, expectedContent, `if child did not fail, result should be as expected`);

        /*
            process failed
         */
        opt = {trim:true};
        cmdline = 'data/test1.sh 10 2';
        try {
            await exec(cmdline, opt);
        }
        catch (e) {
            expectedContent = `1\n3\n5\n7\n9`;
            content = e.message;
            tester.assertEq(content, expectedContent, `if child failed, exception message should be as expected`);
        }

        /*
            process failed but error was ignored
         */
        opt = {trim:true, ignoreError:true};
        cmdline = 'data/test1.sh 10 2';
        content = await exec(cmdline, opt);
        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(content, expectedContent, `if child failed but {opt.ignoreError} is {true}, result should be as expected`);

        done();
    }, {isAsync:true});

    tester.test('process.waitpid', async (done) => {
        let opt, cmdline, p;
        let expectedContent;

        opt = {trim:true};
        cmdline = 'data/test6.sh 5';
        p = new Process(cmdline, opt);
        p.run();
        tester.assert(p.running, `process should be running`);
        /*
            waitpid can be used to wait any process asynchronously
         */
        await waitpid(p.pid);
        expectedContent = `1\n2\n3\n4\n5`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);
        tester.assert(!p.running, `process should not be running anymore`);

        done();
    }, {isAsync:true});

    tester.test('process.ProcessSync (props)', () => {
        const props = {cmd:'date'};
        const p = new ProcessSync('date', {
            props:props
        });
        tester.assertEq(p.props, props, `{props} should match`);
    });

    tester.test('process.ProcessSync (without stderr redirect)', () => {
        const opt = {passStderr: false, trim:false};
        const cmdline = 'data/test1.sh 10';
        let expectedContent;
        const p = new ProcessSync(cmdline, opt);
        const success = p.run();

        tester.assert(success, `result should be true`);
        tester.assert(p.success, `.success should be true`);

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);

        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `'stderr' content retrieved using 'stderr' property should be as expected`);
    });

    tester.test('process.ProcessSync (with stderr redirected to stdout)', () => {
        const opt = {passStderr: false, trim:false, redirectStderr: true};
        const cmdline = 'data/test1.sh 10';
        const p = new ProcessSync(cmdline, opt);
        let expectedContent;
        p.run();

        expectedContent = `1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `'stdout' content retrieved using 'stdout' property should be as expected`);
    });

    tester.test('process.ProcessSync (trimming)', () => {
        let opt, cmdline, p;
        let expectedContent;

        /*
            without trimming
         */
        opt = {passStderr: false, trim:false};
        cmdline = 'data/test3.sh 10';
        p = new ProcessSync(cmdline, opt);
        p.run();

        expectedContent = `\n\n   2\n4\n6\n8\n10\n\n\n   `;
        tester.assertEq(p.stdout, expectedContent, `without trimming 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `\n\n   1\n3\n5\n7\n9\n\n\n   `;
        tester.assertEq(p.stderr, expectedContent, `without trimming 'stderr' content retrieved using 'stderr' property should be as expected`);

        /*
            with trimming
         */
        opt = {passStderr: false, trim:true};
        cmdline = 'data/test3.sh 10';
        p = new ProcessSync(cmdline, opt);
        p.run();

        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(p.stdout, expectedContent, `with trimming 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n3\n5\n7\n9`;
        tester.assertEq(p.stderr, expectedContent, `with trimming 'stderr' content retrieved using 'stderr' property should be as expected`);
    });

    tester.test('process.ProcessSync (skip blank lines)', () => {
        let opt, cmdline, p;
        let expectedContent;

        /*
            without skipping blank lines
         */
        opt = {passStderr: false, trim:false, skipBlankLines:false};
        cmdline = 'data/test4.sh 10';
        p = new ProcessSync(cmdline, opt);
        p.run();

        expectedContent = `2\n\n4\n\n6\n\n8\n\n10\n\n`;
        tester.assertEq(p.stdout, expectedContent, `without skipping blank lines 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n\n3\n\n5\n\n7\n\n9\n\n`;
        tester.assertEq(p.stderr, expectedContent, `without skipping blank lines 'stderr' content retrieved using 'stderr' property should be as expected`);

        /*
            when skipping blank lines
         */
        opt = {passStderr: false, trim:false, skipBlankLines:true};
        cmdline = 'data/test4.sh 10';
        p = new ProcessSync(cmdline, opt);
        p.run();

        expectedContent = `2\n4\n6\n8\n10\n`;
        tester.assertEq(p.stdout, expectedContent, `when skipping blank lines 'stdout' content retrieved using 'stdout' property should be as expected`);
        expectedContent = `1\n3\n5\n7\n9\n`;
        tester.assertEq(p.stderr, expectedContent, `when skipping blank lines 'stderr' content retrieved using 'stderr' property should be as expected`);
    });

    tester.test('process.ProcessSync (env)', () => {
        let opt, cmdline, p;
        let expectedContent;
        let newEnv;

        /*
            variables should not be defined
         */
        opt = {passStderr: false, trim:false};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        p = new ProcessSync(cmdline, opt);
        p.run();
        expectedContent = `DUMMY_VAR1=\nDUMMY_VAR2=\n`;
        tester.assertEq(p.stdout, expectedContent, `without defining variables in parent, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            variable DUMMY_VAR1 should be defined
         */
        opt = {passStderr: false, trim:false};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new ProcessSync(cmdline, opt);
        p.run();
        expectedContent = `DUMMY_VAR1=1\nDUMMY_VAR2=\n`;
        tester.assertEq(p.stdout, expectedContent, `when defining DUMMY_VAR1 in parent, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            variable DUMMY_VAR2 should be defined, but not variable DUMMY_VAR1 when child env is replaced
         */
        newEnv = {'DUMMY_VAR2':'2'};
        opt = {passStderr: false, trim:false, replaceEnv:true, env:newEnv};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new ProcessSync(cmdline, opt);
        p.run();
        expectedContent = `DUMMY_VAR1=\nDUMMY_VAR2=2\n`;
        tester.assertEq(p.stdout, expectedContent, `when replacing child env with ${JSON.stringify(newEnv)}, 'stdout' content retrieved using 'stdout' property should be as expected`);

        /*
            both variables should be defined when child env is updated instead of being replaced
         */
        newEnv = {'DUMMY_VAR2':'2'};
        opt = {passStderr: false, trim:false, replaceEnv:false, env:newEnv};
        cmdline = 'data/test5.sh';
        std.unsetenv('DUMMY_VAR1');
        std.unsetenv('DUMMY_VAR2');
        std.setenv('DUMMY_VAR1', '1');
        p = new ProcessSync(cmdline, opt);
        p.run();
        expectedContent = `DUMMY_VAR1=1\nDUMMY_VAR2=2\n`;
        tester.assertEq(p.stdout, expectedContent, `when updating child env with ${JSON.stringify(newEnv)}, 'stdout' content retrieved using 'stdout' property should be as expected`);
    });

    tester.test('process.ProcessSync (use shell)', () => {
        let opt, cmdline, p;
        let expectedContent;
        let result;

        /*
            process should fail
         */
        opt = {passStderr: false, trim:false, useShell:false};
        cmdline = 'a=1 ; echo $a';
        p = new ProcessSync(cmdline, opt);
        result = p.run();
        tester.assert(!result, `when executing ${JSON.stringify(cmdline)} without shell, process should fail (exitCode = ${p.exitCode})`);
        tester.assert(!p.success, `when executing ${JSON.stringify(cmdline)} without shell, .success should be false (exitCode = ${p.exitCode})`);
        tester.assert(0 != p.exitCode, `when executing ${JSON.stringify(cmdline)} without shell, exit code should be != 0 (exitCode = ${p.exitCode})`);

        /*
            process should not fail
         */
        opt = {passStderr: false, trim:false, useShell:true};
        cmdline = 'a=1 ; echo $a';
        p = new ProcessSync(cmdline, opt);
        p.run();
        tester.assert(0 == p.exitCode, `when executing ${JSON.stringify(cmdline)} with shell, exit code should be 0 (exitCode =${p.exitCode})`);
        tester.assert(p.success, `when executing ${JSON.stringify(cmdline)} with shell, .success should be true (exitCode =${p.exitCode})`);
        expectedContent = "1\n";
        tester.assertEq(p.stdout, expectedContent, `when executing ${JSON.stringify(cmdline)} with shell, 'stdout' content retrieved using 'stdout' property should be as expected`);
    });

    tester.test('process.ProcessSync (use path)', () => {
        let opt, cmdline, p;

        /*
            process should fail
         */
        opt = {passStderr: false, trim:false, usePath:false};
        cmdline = 'script_which_does_not_exist_in_path.sh';
        p = new ProcessSync(cmdline, opt);
        p.run();
        tester.assert(0 != p.exitCode, `when executing ${JSON.stringify(cmdline)} without using PATH, process should fail (${p.exitCode})`);

        /*
            process should not fail
         */
        opt = {passStderr: false, trim:false, usePath:true};
        cmdline = 'script_which_does_not_exist_in_path.sh';
        const path = std.getenv('PATH')
        std.setenv('PATH', `data:${path}`);
        p = new ProcessSync(cmdline, opt);
        p.run();
        std.setenv('PATH', `${path}`);
        tester.assert(0 == p.exitCode, `when executing ${JSON.stringify(cmdline)} using PATH, process should not fail (${p.exitCode})`);
    });

    tester.test('process.ProcessSync (stdin redirect)', () => {
        let opt, cmdline, p;

        // load input
        const inputFile = 'data/input1.txt';
        const input = std.loadFile(inputFile).trim();
        const tmpFile = std.tmpfile();
        tmpFile.puts(input);
        tmpFile.flush();
        // rewind
        tmpFile.seek(0);

        const expectedContent = input.split("\n").map(line => `[in] ${line}`).join("\n");

        cmdline = 'data/test9.sh';
        opt = {passStderr: false, stdin:tmpFile.fileno()};
        p = new ProcessSync(cmdline, opt);
        p.run();

        // tmp file can now be closed
        tmpFile.close();

        tester.assertEq(p.stdout, expectedContent, `when redirecting 'stdin', 'stdout' content retrieved using 'stdout' property should be as expected`);
    });

    tester.test('process.ProcessSync (with input)', () => {
        let opt, cmdline, p;

        // load input
        const inputFile = 'data/input1.txt';
        const input = std.loadFile(inputFile).trim();

        const expectedContent = input.split("\n").map(line => `[in] ${line}`).join("\n");

        cmdline = 'data/test9.sh';
        opt = {passStderr: false, input: input};
        p = new ProcessSync(cmdline, opt);
        p.run();

        tester.assertEq(p.stdout, expectedContent, `when passing 'input', 'stdout' content retrieved using 'stdout' property should be as expected`);
    });

    tester.test('process.execSync', () => {
        let opt, cmdline;
        let expectedContent, content;

        /*
            process did not fail
         */
        opt = {passStderr:false, trim:true};
        cmdline = 'data/test1.sh 10';
        content = execSync(cmdline, opt);
        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(content, expectedContent, `if child did not fail, result should be as expected`);

        /*
            process failed
         */
        opt = {passStderr:false, trim:true};
        cmdline = 'data/test1.sh 10 2';
        try {
            execSync(cmdline, opt);
        }
        catch (e) {
            expectedContent = `1\n3\n5\n7\n9`;
            content = e.message;
            tester.assertEq(content, expectedContent, `if child failed, exception message should be as expected`);
        }

        /*
            process failed but error was ignored
         */
        opt = {passStderr:false, trim:true, ignoreError:true};
        cmdline = 'data/test1.sh 10 2';
        content = execSync(cmdline, opt);
        expectedContent = `2\n4\n6\n8\n10`;
        tester.assertEq(content, expectedContent, `if child failed but {opt.ignoreError} is {true}, result should be as expected`);
    });
}