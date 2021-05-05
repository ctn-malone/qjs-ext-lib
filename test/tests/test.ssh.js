import { tester } from '../../src/tester.js';
import { Ssh, sshExec, multiSsh } from '../../src/ssh.js'
import { wait } from '../../src/timers.js';

import * as std from 'std';
import * as os from 'os';

export default () => {

    // wether or not we should do real ssh connections
    const real_ssh_connect = ('1' == std.getenv('QJS_EXT_TEST_SSH_REAL_CONNECT'));
    // whether or not local forward should be tested
    const real_local_forward = (real_ssh_connect && ('1' == std.getenv('QJS_EXT_TEST_SSH_REAL_LOCAL_FORWARD')));
    // whether or not remote forward should be tested
    const real_remote_forward = (real_ssh_connect && ('1' == std.getenv('QJS_EXT_TEST_SSH_REAL_REMOTE_FORWARD')));
    // full path to data directory
    const data_directory = `${os.getcwd()[0]}/data`;

    /**
     * Get cmdline for a script located in data directory
     * 
     * @param {string} cmd command line to execute 
     * @return {string}
     */
    const getRemoteCmd = (cmd) => {
        return `${data_directory}/${cmd}`;
    }

    tester.test('ssh.Ssh (mock / default)', () => {
        const ssh = new Ssh('127.0.0.1', 'date');
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 22, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, undefined, `user should match`);
        tester.assertEq(ssh.uri, '127.0.0.1:22', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / no cmd)', () => {
        const ssh = new Ssh('127.0.0.1', '');
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -N -o StrictHostKeyChecking=no 127.0.0.1`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 22, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, undefined, `user should match`);
        tester.assertEq(ssh.uri, '127.0.0.1:22', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / custom port using options)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {port:2222});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 2222 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 2222, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, undefined, `user should match`);
        tester.assertEq(ssh.uri, '127.0.0.1:2222', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / custom port using host uri)', () => {
        const ssh = new Ssh('127.0.0.1:2222', 'date');
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 2222 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 2222, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, undefined, `user should match`);
        tester.assertEq(ssh.uri, '127.0.0.1:2222', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / custom user using options)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {user:'admin'});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no admin@127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 22, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, 'admin', `user should match`);
        tester.assertEq(ssh.uri, 'admin@127.0.0.1:22', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / custom user using host uri)', () => {
        const ssh = new Ssh('admin@127.0.0.1', 'date');
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no admin@127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 22, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, 'admin', `user should match`);
        tester.assertEq(ssh.uri, 'admin@127.0.0.1:22', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / custom user & port using host uri)', () => {
        const ssh = new Ssh('admin@127.0.0.1:2222', 'date');
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 2222 -F /dev/null -o StrictHostKeyChecking=no admin@127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
        tester.assertEq(ssh.port, 2222, `port should match`);
        tester.assertEq(ssh.host, '127.0.0.1', `host should match`);
        tester.assertEq(ssh.user, 'admin', `user should match`);
        tester.assertEq(ssh.uri, 'admin@127.0.0.1:2222', `uri should match`);
    });

    tester.test('ssh.Ssh (mock / {ignoreUserConfig:false} )', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {ignoreUserConfig:false});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / {checkHostKey:true} )', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {checkHostKey:true});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / {connectTimeout:5} )', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {connectTimeout:5});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no -o ConnectTimeout=5 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / {pseudoTerminal:true} )', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {pseudoTerminal:true});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -t -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / identityFile)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {identityFile:'/home/user/.ssh/id_rsa'});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no -o IdentityFile=/home/user/.ssh/id_rsa -o IdentitiesOnly=yes 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / environment variables)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {
            env:{'var1':1,'var2':2}
        });
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 export var1=1 var2=2 ; date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / supported custom SSH opts)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {sshOpt:{'Ciphers':'aes128-ctr,aes192-ctr'}});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no -o Ciphers=aes128-ctr,aes192-ctr 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / unsupported custom SSH opts)', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {sshOpt:{'LogLevel':'DEBUG3'}});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 date`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / {redirectStderr:true} )', () => {
        const ssh = new Ssh('127.0.0.1', 'date', {redirectStderr:true});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -o StrictHostKeyChecking=no 127.0.0.1 date 2>&1`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / local forward)', () => {
        const ssh = new Ssh('127.0.0.1', '', {localForward:[
            {remoteAddr:'127.0.0.1', localPort:10001, remotePort:22},
            {remoteAddr:'127.0.0.1', localPort:10002, remotePort:22},
        ]});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -N -o StrictHostKeyChecking=no -o LocalForward=127.0.0.1:10001 127.0.0.1:22 -o LocalForward=127.0.0.1:10002 127.0.0.1:22 127.0.0.1`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (mock / remote forward)', () => {
        const ssh = new Ssh('127.0.0.1', '', {remoteForward:[
            {remoteAddr:'127.0.0.1', localPort:22, remotePort:10001},
            {remoteAddr:'127.0.0.1', localPort:22, remotePort:10002},
        ]});
        const expectedCmdline = `ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 22 -F /dev/null -N -o StrictHostKeyChecking=no -o RemoteForward=127.0.0.1:10001 127.0.0.1:22 -o RemoteForward=127.0.0.1:10002 127.0.0.1:22 127.0.0.1`;
        const cmdline = ssh.cmdline;
        tester.assertEq(cmdline, expectedCmdline, `cmdline should match`);
    });

    tester.test('ssh.Ssh (real / execute test1.sh {redirectStderr:false} )', async (done) => {
        const cmd = getRemoteCmd('test1.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd);
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        tester.assert(!ssh.failed, `failed should be false`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(!ssh.commandFailed, `commandFailed should be false`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const stdout = ssh.stdout;
        const expectedStdout = `2\n4`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `1\n3\n5`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test1.sh {redirectStderr:true} )', async (done) => {
        const cmd = getRemoteCmd('test1.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {redirectStderr:true});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        tester.assert(!ssh.failed, `failed should be false`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(!ssh.commandFailed, `commandFailed should be false`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const stdout = ssh.stdout;
        const expectedStdout = `1\n2\n3\n4\n5`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = '';
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test1.sh with non-zero exit code)', async (done) => {
        const cmd = getRemoteCmd('test1.sh 5 3');
        const ssh = new Ssh('127.0.0.1', cmd);
        const result = await ssh.run();
        tester.assert(!result, `execution should fail`);
        tester.assert(ssh.failed, `failed should be true`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(ssh.commandFailed, `commandFailed should be true`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const state = ssh.state;
        tester.assertEq(state.exitCode, 3, `exitCode should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / invalid command', async (done) => {
        const cmd = getRemoteCmd('invalid.sh');
        const ssh = new Ssh('127.0.0.1', cmd);
        const result = await ssh.run();
        tester.assert(!result, `execution should fail`);
        tester.assert(ssh.failed, `failed should be true`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(ssh.commandFailed, `commandFailed should be true`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const state = ssh.state;
        tester.assertEq(state.exitCode, 127, `exitCode should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / invalid auth', async (done) => {
        const ssh = new Ssh('127.0.0.1', 'date', {
            identityFile:'/dev/null'
        });
        const result = await ssh.run();
        tester.assert(!result, `execution should fail`);
        tester.assert(ssh.failed, `failed should be true`);
        tester.assert(ssh.sshFailed, `sshFailed should be true`);
        tester.assertNeq(ssh.sshError, undefined, `sshError should be defined`);
        tester.assertEq(ssh.sshErrorReason, 'auth_error', `sshErrorReason should match`);
        tester.assert(!ssh.commandFailed, `commandFailed should be false`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const state = ssh.state;
        tester.assertEq(state.exitCode, 255, `exitCode should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test2.sh {trim:false} )', async (done) => {
        const cmd = getRemoteCmd('test2.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {trim:false});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `24\n`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `135\n`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test4.sh {trim:false,skipBlankLines:false} )', async (done) => {
        const cmd = getRemoteCmd('test4.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {trim:false,skipBlankLines:false});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `2\n\n4\n\n`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `1\n\n3\n\n5\n\n`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test4.sh {trim:true,skipBlankLines:false} )', async (done) => {
        const cmd = getRemoteCmd('test4.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {trim:true,skipBlankLines:false});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `2\n\n4`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `1\n\n3\n\n5`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test3.sh {trim:false,skipBlankLines:true} )', async (done) => {
        const cmd = getRemoteCmd('test4.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {trim:false,skipBlankLines:true});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `2\n4\n`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `1\n3\n5\n`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test3.sh {trim:true,skipBlankLines:true} )', async (done) => {
        const cmd = getRemoteCmd('test4.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {trim:true,skipBlankLines:true});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `2\n4`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = `1\n3\n5`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test7.sh {maxTime:1} )', async (done) => {
        const cmd = getRemoteCmd('test7.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {maxTime:1});
        const result = await ssh.run();
        tester.assert(!result, `execution should fail`);
        tester.assert(ssh.failed, `failed should be true`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(ssh.commandFailed, `commandFailed should be true`);
        tester.assert(ssh.didTimeout, `didTimeout should be true`);
        tester.assert(!ssh.wasCancelled, `wasCancelled should be false`);
        const state = ssh.state;
        tester.assertEq(state.exitCode, -os.SIGTERM, `exitCode should match`);
        tester.assertEq(state.signal, 'SIGTERM', `signal should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test7.sh and cancel)', async (done) => {
        const cmd = getRemoteCmd('test7.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd);
        const p = ssh.run();
        await wait(500);
        ssh.cancel();
        const result = await p;
        tester.assert(!result, `execution should fail`);
        tester.assert(ssh.failed, `failed should be true`);
        tester.assert(!ssh.sshFailed, `sshFailed should be false`);
        tester.assertEq(ssh.sshError, undefined, `sshError should be undefined`);
        tester.assertEq(ssh.sshErrorReason, undefined, `sshErrorReason should be undefined`);
        tester.assert(ssh.commandFailed, `commandFailed should be true`);
        tester.assert(!ssh.didTimeout, `didTimeout should be false`);
        tester.assert(ssh.wasCancelled, `wasCancelled should be true`);
        const state = ssh.state;
        tester.assertEq(state.exitCode, -os.SIGINT, `exitCode should match`);
        tester.assertEq(state.signal, 'SIGINT', `signal should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test2.sh with event listeners {lineBuffered:false} )', async (done) => {
        const cmd = getRemoteCmd('test2.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {lineBuffered:false});
        let stdout = '', stderr = '';
        ssh.setEventListener('stdout', (obj) => {
            stdout += obj.data;
        });
        ssh.setEventListener('stderr', (obj) => {
            stderr += obj.data;
        });
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const expectedStdout = `24\n`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const expectedStderr = `135\n`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test2.sh with event listeners {lineBuffered:true} )', async (done) => {
        const cmd = getRemoteCmd('test2.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {lineBuffered:true});
        let stdout = '', stderr = '';
        ssh.setEventListener('stdout', (obj) => {
            stdout += obj.data;
        });
        ssh.setEventListener('stderr', (obj) => {
            stderr += obj.data;
        });
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const expectedStdout = `24`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const expectedStderr = `135`;
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test1.sh {pseudoTerminal:true,normalizeEol:false} )', async (done) => {
        const cmd = getRemoteCmd('test1.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {pseudoTerminal:true});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `1\r\n2\r\n3\r\n4\r\n5`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        // when using pseudo terminal, stderr will be redirected to stdout by OpenSSH
        const expectedStderr = '';
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test1.sh {pseudoTerminal:true,normalizeEol:true} )', async (done) => {
        const cmd = getRemoteCmd('test1.sh 5');
        const ssh = new Ssh('127.0.0.1', cmd, {pseudoTerminal:true,normalizeEol:true});
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `1\n2\n3\n4\n5`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        // when using pseudo terminal, stderr will be redirected to stdout by OpenSSH
        const expectedStderr = '';
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test5.sh without environment variables)', async (done) => {
        const cmd = getRemoteCmd('test5.sh');
        const ssh = new Ssh('127.0.0.1', cmd);
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `DUMMY_VAR1=\nDUMMY_VAR2=`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = '';
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / execute test5.sh with environment variables)', async (done) => {
        const cmd = getRemoteCmd('test5.sh');
        const ssh = new Ssh('127.0.0.1', cmd, {
            env:{'DUMMY_VAR1':1, 'DUMMY_VAR2':2}
        });
        const result = await ssh.run();
        tester.assert(result, `execution should succeed`);
        const stdout = ssh.stdout;
        const expectedStdout = `DUMMY_VAR1=1\nDUMMY_VAR2=2`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        const stderr = ssh.stderr;
        const expectedStderr = '';
        tester.assertEq(stderr, expectedStderr, `stderr content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.Ssh (real / local port forwarding  [local:10001 => remote:22, local:10002 => remote:22])', async (done) => {
        const ssh = new Ssh('127.0.0.1', '', {
            localForward:[
                {remoteAddr:'127.0.0.1', remotePort:22, localPort:10001},
                {remoteAddr:'127.0.0.1', remotePort:22, localPort:10002}
            ]
        });
        let result, stdout;
        const p = ssh.run();
        result = await ssh.waitForSessionSetup();
        tester.assert(result, `session setup should succeed`);
        const cmd = getRemoteCmd('test7.sh');
        const expectedStdout = 'OK';
        const ssh1 = new Ssh('127.0.0.1', cmd, {port:10001});
        result = await ssh1.run();
        tester.assert(result, `execution using local port 10001 should succeed`);
        stdout = ssh1.stdout;
        tester.assertEq(stdout, expectedStdout, `stdout content should match when using local port 10001`);
        const ssh2 = new Ssh('127.0.0.1', cmd, {port:10002});
        result = await ssh2.run();
        tester.assert(result, `execution using local port 10002 should succeed`);
        stdout = ssh2.stdout;
        tester.assertEq(stdout, expectedStdout, `stdout content should match when using local port 10002`);
        // stop forwarding
        ssh.cancel();
        await p;
        tester.assert(ssh.wasCancelled, `wasCancelled should be true`);
        done();
    }, {isAsync:true, skip:!real_local_forward});
    
    tester.test('ssh.Ssh (real / remote port forwarding  [remote:10001 => local:22, remote:10002 => local:22])', async (done) => {
        const ssh = new Ssh('127.0.0.1', '', {
            remoteForward:[
                {remoteAddr:'127.0.0.1', remotePort:10001, localPort:22},
                {remoteAddr:'127.0.0.1', remotePort:10002, localPort:22}
            ]
        });
        let result, stdout;
        const p = ssh.run();
        result = await ssh.waitForSessionSetup();
        tester.assert(result, `session setup should succeed`);
        tester.assertEq(ssh.remotePorts, undefined, `remotePorts should be undefined`);
        const cmd = getRemoteCmd('test7.sh');
        const expectedStdout = 'OK';
        const ssh1 = new Ssh('127.0.0.1', cmd, {port:10001});
        result = await ssh1.run();
        tester.assert(result, `execution using remote port 10001 should succeed`);
        stdout = ssh1.stdout;
        tester.assertEq(stdout, expectedStdout, `stdout content should match when using remote port 10001`);
        const ssh2 = new Ssh('127.0.0.1', cmd, {port:10002});
        result = await ssh2.run();
        tester.assert(result, `execution using port 10002 should succeed`);
        stdout = ssh2.stdout;
        tester.assertEq(stdout, expectedStdout, `stdout content should match when using remote port 10002`);
        // stop forwarding
        ssh.cancel();
        await p;
        tester.assert(ssh.wasCancelled, `wasCancelled should be true`);
        done();
    }, {isAsync:true, skip:!real_remote_forward});

    tester.test('ssh.Ssh (real / remote port forwarding  [remote:? => local:22])', async (done) => {
        const ssh = new Ssh('127.0.0.1', '', {
            remoteForward:[
                {remoteAddr:'127.0.0.1', localPort:22}
            ]
        });
        let result, stdout;
        const p = ssh.run();
        result = await ssh.waitForSessionSetup();
        tester.assert(result, `session setup should succeed`);
        const remotePorts = ssh.remotePorts;
        tester.assertNeq(remotePorts, undefined, `remotePorts should not be undefined`);
        tester.assertEq(remotePorts.length, 1, `size of remotePorts should be as expected`);
        let dynamicPort = '?';
        if (undefined !== remotePorts) {
            dynamicPort = remotePorts[0].remotePort;
        }
        const cmd = getRemoteCmd('test7.sh');
        const expectedStdout = 'OK';
        const ssh1 = new Ssh('127.0.0.1', cmd, {port:dynamicPort});
        result = await ssh1.run();
        tester.assert(result, `execution using dynamically allocated remote port ${dynamicPort} should succeed`);
        stdout = ssh1.stdout;
        tester.assertEq(stdout, expectedStdout, `stdout content should match when using dynamically allocated remote port`);
        // stop forwarding
        ssh.cancel();
        await p;
        tester.assert(ssh.wasCancelled, `wasCancelled should be true`);
        done();
    }, {isAsync:true, skip:!real_remote_forward});

    tester.test('ssh.sshExec (real / execute test8.sh with success)', async (done) => {
        const cmd = getRemoteCmd('test8.sh OK');
        const stdout = await sshExec('127.0.0.1', cmd);
        const expectedStdout = `OK`;
        tester.assertEq(stdout, expectedStdout, `stdout content should match`);
        done();
    }, {isAsync:true, skip:!real_ssh_connect});
    
    tester.test('ssh.sshExec (real / execute test2.sh with non-zero exit code)', async (done) => {
        const cmd = getRemoteCmd('test2.sh 5 3');
        const expectedStderr = `135`;
        try {
            await sshExec('127.0.0.1', cmd);
            tester.assert(false, `an exception should have been thrown`);
        }
        catch (e) {
            tester.assertNeq(e.state, undefined, `exception.state should be defined`);
            tester.assertEq(e.sshError, undefined, `exception.sshError should be undefined`);
            tester.assertEq(e.sshErrorReason, undefined, `exception.sshErrorReason should be undefined`);
            tester.assertEq(e.message, expectedStderr, `exception.message should match`);
        }
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

    tester.test('ssh.multiSsh (real / execute test8.sh 3 times in parallel)', async (done) => {
        const list = [];
        for (let i = 0; i < 3; ++i) {
            list.push(new Ssh('127.0.0.1', getRemoteCmd(`test8.sh ${i}`)));
        }
        const responses = (await multiSsh(list)).map((e => e.ssh.stdout));
        for (let i = 0; i < 3; ++i) {
            const expectedStdout = `${i}`;
            tester.assertEq(responses[i], expectedStdout, `stdout content should match for execution #${i+1}`);
        }
        done();
    }, {isAsync:true, skip:!real_ssh_connect});

}