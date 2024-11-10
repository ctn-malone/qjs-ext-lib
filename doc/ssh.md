<!-- omit in toc -->
# ssh

A wrapper around *ssh* binary

<u>NB</u> : it has **only be tested with OpenSSH**. Following versions have been tested

* OpenSSH_5.5p1 (debian 6.x)
* OpenSSH_6.0p1 (debian 7.x)
* OpenSSH_6.7p1 (debian 8.x)
* OpenSSH_7.4p1 (debian 9.x)
* OpenSSH_7.9p1 (debian 10.x)
* OpenSSH_8.4p1 (debian 11.x)

Following features are not supported

* jump hosts / proxies
* password authentication
* ssh keys with password (auth should be setup using *ssh-agent* or through [`SshAgent`](#sshagent))

Following ssh options are not supported in constructor (and will be ignored if passed in `opt.sshOpt`)

* `LogLevel` : class behaviour relies on `debug` log parsing
* `ProxyCommand` : too complicated to manage
* `LocalForward`, `RemoteForward`, `DynamicForward` (forwarding should be handled using adhoc *constructor* options)

By default, `~/.ssh/config` file will be ignored to avoid unexpected behaviours. Use `opt.ignoreUserConfig` to re-enable it

- [SSH session](#ssh-session)
- [Pseudo terminal](#pseudo-terminal)
- [Ssh](#ssh-1)
  - [Ssh.constructor(...)](#sshconstructor)
  - [Ssh.run(...)](#sshrun)
  - [Ssh.waitForSessionSetup(...)](#sshwaitforsessionsetup)
  - [Ssh.cancel(...)](#sshcancel)
  - [Ssh.setEventListener(...)](#sshseteventlistener)
  - [Ssh.puts](#sshputs)
  - [Ssh.log](#sshlog)
  - [Ssh.cmdline](#sshcmdline)
  - [Ssh.host](#sshhost)
  - [Ssh.port](#sshport)
  - [Ssh.user](#sshuser)
  - [Ssh.uri](#sshuri)
  - [Ssh.stdout](#sshstdout)
  - [Ssh.stderr](#sshstderr)
  - [Ssh.remotePorts](#sshremoteports)
  - [Ssh.didTimeout](#sshdidtimeout)
  - [Ssh.wasCancelled](#sshwascancelled)
  - [Ssh.sshFailed](#sshsshfailed)
  - [Ssh.sshError](#sshssherror)
  - [Ssh.sshErrorReason](#sshssherrorreason)
  - [Ssh.commandFailed](#sshcommandfailed)
  - [Ssh.failed](#sshfailed)
  - [Ssh.state](#sshstate)
  - [Ssh.pid](#sshpid)
  - [Ssh.context](#sshcontext)
  - [Ssh.duration](#sshduration)
  - [Ssh.out](#sshout)
  - [Ssh.err](#ssherr)
- [sshExec(...)](#sshexec)
- [multiSsh](#multissh)
- [SshAgent](#sshagent)
  - [SshAgent.isRunning(...)](#sshagentisrunning)
  - [SshAgent.listIdentities(...)](#sshagentlistidentities)
  - [SshAgent.checkIdentity(...)](#sshagentcheckidentity)
  - [SshAgent.addIdentity(...)](#sshagentaddidentity)
  - [SshAgent.addDefaultIdentities(...)](#sshagentadddefaultidentities)
  - [SshAgent.removeIdentity(...)](#sshagentremoveidentity)
  - [SshAgent.removeDefaultIdentities(...)](#sshagentremovedefaultidentities)
  - [SshAgent.removeAllIdentities(...)](#sshagentremoveallidentities)

## SSH session

An SSH session is a sequence of following steps

1. ssh arguments are parsed
2. client resolves remote hostname
3. client establishes a connection to remote server
4. client checks remote server host key
5. client authenticates to remove server
6. port forwardings are setup (ie: ports binding)
7. client sends command to remove server
8. server executes remote command
9. remote process exits
10. client disconnect from remote server

Session can be considered fully [setup](#sshwaitforsessionsetup) in steps `5` or `6`

Steps `1` to `6` have a corresponding [`sshErrorReason`](#sshssherrorreason) in case of failure

<u>NB</u>: in case port forwarding was requested and forward fails after client has connected to forwarded port, **session will be cancelled** automatically
and :
* `sshErrorReason` will be set to `forward_error`
* `sshError` will contain failure reason

## Pseudo terminal

The behaviour of *stdout*/*stderr* output depends on whether or not a pseudo terminal was allocated (using `opt.pseudoTerminal`)
    
* if a pseudo terminal was allocated (`opt.pseudoTerminal` == `true`)
  * both *stdout* & *stderr* will be multiplexed
  * *EOL* will always be `\r\n`
  * terminating the *ssh* process will terminate the remote process
* if no pseudo terminal was allocated (`opt.pseudoTerminal` == `false`)
  * *stdout* & *stderr* won't be multiplexed
  * *EOL* will be as sent by remote server
  * terminating the *ssh* process will not terminate the remote process

<u>NB</u> : outputing from main program using `\n` instead of `\r\n`, after a pseudo terminal has been allocated, will generate display inconsistencies

Some [wrappers](#sshout) around `std.out` and `std.err` are provided in order to ensure that

* output is using `\r\n` as *EOL* if main program outputs to a *tty* (ie: no pipe)
* output is using `\n` as *EOL* if main program does not output to a *tty* (example: output redirected to a file)

Those wrappers supports following methods

* puts 
* log (same as `puts` with an extra *EOL*)
* printf 
* flush 

## Ssh

This class can be used to execute a remote command using *SSH*

### Ssh.constructor(...)

`new Ssh(host, cmd, opt)`

Constructor

* **host** (*string*) : host to connec to. Format can be one of
  * hostname
  * user@hostname
  * hostname:port
  * user@hostname:port
* **cmd** (*string*) : remote command (can be *empty*)   
* opt (*object*) : options
  * opt.port (*integer*) : remote port (default = `22`)
  * opt.user (*string*) : login user (defaults to current user)
  * opt.ignoreUserConfig (*boolean*) : if `true`, `~/.ssh/config` will be ignored (default = `true`)
  * opt.checkHostKey (*boolean*) : whether or not host key should be  checked (default = `false`)
  * opt.connectTimeout (*integer*) : maximum number of seconds allowed for connection (defaults to *OpenSSH* default)
  * opt.pseudoTerminal (*boolean*) : if `true`, a pseudo terminal will be allocated (default = `false`)
  * opt.identityFile (*string*) : full path to identify file (can be used to bypass agent)
  * opt.env (*object*) dictionary of environment variables to define on remote host
  * opt.localForward (*object|object[]*) : local port forwarding
    * opt.localForward[].remoteAddr (*string*) : remote binding ip address (by default, use remote hostname)
    * opt.localForward[].remotePort (*integer*) : remote binding port (**mandatory**)
    * opt.localForward[].localAddr (*string*) : local binding ip address (default = `127.0.0.1`, use `*` to bind to all interfaces)
    * opt.localForward[].localPort (*integer*) : local binding port (by default, use remote binding port)
  * opt.remoteForward (*object|object[]*) : remote port forwarding
    * opt.remoteForward[].remoteAddr (*string*) : remote binding ip address (default = `127.0.0.1`, use `*` to bind to all interfaces)
    * opt.remoteForward[].remotePort (*integer*) : remote binding port (default = `0`, dynamically allocated by server)
    * opt.remoteForward[].localAddr (*string*) : local binding ip address (default = `127.0.0.1`)
    * opt.remoteForward[].localPort (*integer*) :local binding port (by default, use remote binding port if != `0`)
  * opt.sshOpt (*object*) : dictionary of custom *SSH* options (see https://linux.die.net/man/5/ssh_config)
  * opt.newSession (*boolean*) : if `true` *setsid* will be used (ie: ssh process will not receive `SIGINT` sent to parent) (default = `false`)
  * opt.maxTime (*integer*) :  maximum number of seconds before killing child (if `undefined`, no max time will be configured)
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout* using shell redirection (default = `false`)
  * opt.lineBuffered (*boolean*) : if `true` call *stdout* & *stderr* event listeners only after a line is complete (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`) (does not apply to *stdout* & *stderr* event listeners)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.normalizeEol (*boolean*) : if `true`, `\r` characters will be removed from ssh output (default = `false`)
  * opt.context (*any*) : user define context (can be used to identify ssh requests later by client code)

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname');
await ssh.run();
if (ssh.failed) {
    if (ssh.sshFailed) {
        console.log(`ssh error: ${ssh.sshError} (${ssh.sshErrorReason})`);
    }
    else {
        console.log(`cmd error: ${ssh.stderr}`);
    }
    std.exit(1);
}
console.log(`stdout: ${ssh.stdout}`);
```

### Ssh.run(...)

`.run()`

Execute the remote command

**return** *Promise* which resolves to a *boolean* indicating success or failure

Execution will be considered as failed if one of the following happened

* *ssh* returned an error (ex: wrong auth)
* remote process exited with a non zero code

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname');
const success = await ssh.run();
console.log(`success: ${success}`);
```

### Ssh.waitForSessionSetup(...)

`.waitForSessionSetup()`

Wait until the session is fully setup (ie: before sending the command)

**return** *Promise* which resolves to a *boolean* indicating success or failure

Execution will be considered as failed if one of the following happened

* *ssh* returned an error (ex: wrong auth)

<u>Example</u>

```js
/* 
    Setup local port forwarding (localhost:10000 => test:10000)
    for 5s
 */
const ssh = new Ssh(`root@test:2222`, '', {
    localForward:[{remotePort:10000}],
    maxTime:5
});
const p = ssh.run();
const success = await ssh.waitForSessionSetup();
console.log(`session setup: ${success}`);
if (!success) {
    console.log(`ssh error: ${ssh.sshError} (${ssh.sshErrorReason})`);
    std.exit(1);
}
await p;
```

### Ssh.cancel(...)

`.cancel(opt)`

Cancels *ssh* session (ie: kills ssh process)

* opt (*object*) : options
  * opt.signal (*integer*) : signal signal to use (default = `os.SIGINT`)

**return** *boolean* : `true` if *ssh* process was successfully killed, `false` otherwise

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2');
const p = ssh.run();
os.setTimeout(() => {
    ssh.cancel();
}, 500);
await p;
console.log(`wasCancelled: ${ssh.wasCancelled}`);
```

### Ssh.setEventListener(...)

`.setEventListener(eventType, cb)`

Defines event listeners. Any previously defined listener will be replaced.

* eventType (*string*) : event to define listener for
* cb (*function*) : callback

Following event are supported :

* stdout : triggered whenever data was generated by remote command on *stdout* with a single *object* as argument
  * pid (*integer*) : process pid
  * data (*string*) : output
* stderr : triggered whenever data was generated by remote command on *stderr* with a single *object* as argument
  * pid (*integer*) : process pid
  * data (*string*) : output
* exit : triggered after *ssh* session is terminated (*ssh* error or remote process exited) with a single *object* as argument
  * state (*object*) as returned by `Ssh.state` property
  * sshError (*string*) (will be `undefined` if there was no *ssh* error)
  * sshErrorReason (*string*) (will be `undefined` if there was no *ssh* error)
  * context (*any*) as returned by `Ssh.context` property


<u>Example</u>

```js
/*
  Writes every even number to stdout & every odd number to stderr
 */
const ssh = new Ssh('root@test:2222', 'for i in $(seq 1 5) ; do if [ $(($i % 2)) -eq 0 ] ; then echo $i ; else echo $i 1>&2 ; fi ; sleep 1s ; done', {
    lineBuffered:true
});
ssh.setEventListener('stdout', (obj) => {console.log(`[${obj.pid}] stdout: ${obj.data}`)});
ssh.setEventListener('stderr', (obj) => {console.log(`[${obj.pid}] stderr: ${obj.data}`)});
ssh.setEventListener('exit', (obj) => {console.log(`[${obj.state.pid}] state: ${JSON.stringify(obj.state)}`)});
await ssh.run();
```

### Ssh.puts

`Ssh.puts(str)`

Outputs a string (alias of `.out.puts`)

* str (*string*) : string to output

### Ssh.log

`Ssh.log(str)`

Outputs a string with an extra *EOL* (alias of `.out.log`)

* str (*string*) : string to output

### Ssh.cmdline

`.cmdline`

Retrieves *ssh* command line corresponding to the session. It's likely to be invalid when pasted into a terminal since it will lack shell escaping

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2');
console.log(ssh.cmdline);
```

Above code will print

```
ssh -v -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -p 2222 -o StrictHostKeyChecking=no root@test sleep 2
```
### Ssh.host

`.host`

Retrieves remote host

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'date');
console.log(ssh.host);
```

Above code will print

```
test
```

### Ssh.port

`.port`

Retrieves remote port

**return** *integer*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'date');
console.log(ssh.port);
```

Above code will print

```
2222
```

### Ssh.user

`.user`

Retrieves *SSH* user

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'date');
console.log(ssh.port);
```

Above code will print

```
root
```

### Ssh.uri

`.uri`

Retrieves *SSH* uri (`user@host:port` or `host@port`)

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'date');
console.log(ssh.port);
```

Above code will print

```
root@test:2222
```

### Ssh.stdout

`.stdout`

Returns all output generated by the remote command process on *stdout*. It will be empty if a *stdout* event listener was defined

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh('root@test:2222', 'date');
await ssh.run();
console.log(`stdout: ${ssh.stdout}`);
```

### Ssh.stderr

`.stderr`

Returns all content generated by the remote command on *stderr*. It will be empty if a *stderr* event listener was defined

**return** *string*

<u>Example</u>

```js
const ssh = new Ssh('root@test:2222', 'date && hostname 1>&2');
await ssh.run();
console.log(`stdout: ${ssh.stdout}`);
console.log(`stderr: ${ssh.stderr}`);
```

### Ssh.remotePorts

`.remotePorts`

Retrieves the ports which have been dynamically allocated by remote host

**return** *object[]* where each *object* has following properties

* remotePort (*integer*) : the port which was dynamically allocated by remote host
* localAddr (*string*) : local ip address to which traffic will be redirected
* localPort (*integer*) : local port to which traffic will be redirected

<u>Example</u>

```js
/* 
    Setup dynamic remote port forwarding (test:? => 127.0.0.1:22)
 */
const ssh = new Ssh(`root@test`, '', {
    remoteForward:[{localPort:22}]
});
const p = ssh.run();
const success = await ssh.waitForSessionSetup();
console.log(`session setup: ${success}`);
if (!success) {
    console.log(`ssh error: ${ssh.sshError} (${ssh.sshErrorReason})`);
    std.exit(1);
}
console.log(JSON.stringify(ssh.remotePorts));
ssh.cancel();
await p;
```

### Ssh.didTimeout

`.didTimeout`

Indicates whether or not *ssh* session timed out (because of `opt.maxTime`)

**return** *boolean*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2', {
    maxTime: 1
});
await ssh.run();
console.log(`didTimeout: ${ssh.didTimeout}`);
```

### Ssh.wasCancelled

`.wasCancelled`

Indicates whether or not *ssh* session was cancelled (because `Ssh.cancel()` method was called)

**return** *boolean*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2');
const p = ssh.run();
os.setTimeout(() => {
    ssh.cancel();
}, 500);
await p;
console.log(`wasCancelled: ${ssh.wasCancelled}`);
```

### Ssh.sshFailed

`.sshFailed`

Indicates whether or not *ssh* failed (ex: no route to host)

**return** *boolean*

<u>Example</u>

```js
  const ssh = new Ssh(`root@invalid-host`, 'sleep 2');
  await ssh.run();
  console.log(`ssh failed: ${ssh.sshFailed}`);
  if (ssh.sshFailed) {
      console.log(`ssh error : ${ssh.sshError} (${ssh.sshErrorReason})`);
  }
```

### Ssh.sshError

`.sshError`

Retrieves *ssh* error message

**return** *string*

Property will be `undefined` if there was no *ssh* error

<u>Example</u>

```js
  const ssh = new Ssh(`root@invalid-host`, 'sleep 2');
  await ssh.run();
  console.log(`ssh failed: ${ssh.sshFailed}`);
  if (ssh.sshFailed) {
      console.log(`ssh error : ${ssh.sshError} (${ssh.sshErrorReason})`);
  }
```

### Ssh.sshErrorReason

`.sshErrorReason`

Retrieves the reason of the *ssh* error. Will be `undefined` unless ssh connection failed

**return** *string*

Can be one of

* unknown : reason is unknown ;) (this should not happen)
* ssh_not_found : ssh binary was not found
* command_error : one argument provided to ssh was wrong
* resolve_error : hostname could not be resolved
* connect_error : a connection error occured (timeout, no route ...)
* host_key_error : the verification of the remote host key failed
* auth_error : authentication was refused by server
* forward_error : local or remote forward failed

<u>Example</u>

```js
  const ssh = new Ssh(`root@invalid-host`, 'sleep 2');
  await ssh.run();
  console.log(`ssh failed: ${ssh.sshFailed}`);
  if (ssh.sshFailed) {
      console.log(`ssh error : ${ssh.sshError} (${ssh.sshErrorReason})`);
  }
```

### Ssh.commandFailed

`.commandFailed`

Indicates whether or not remote command failed (ie: non-zero exit code)

**return** *boolean*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname && exit 3');
await ssh.run();
console.log(`command failed: ${ssh.commandFailed} (${ssh.state.exitCode})`);
```

### Ssh.failed

`.failed`

Indicates whether or not session failed (*ssh* failure or remote command failure)

**return** *boolean*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname && exit 3');
await ssh.run();
console.log(`failed: ${ssh.failed}`);
```

### Ssh.state

`.state`

Returns process state (pid, exitCode ...)

**return** *object* with following properties

* pid (*integer*) : ssh process pid
* exitCode (*integer*) : exit code of the ssh process or remote process
* didTimeout (*boolean*) : whether or not session was terminated after max time
* wasCancelled (*boolean*) : whether or not session was cancel using `cancel` method
* signal (*string*) : signal name (only defined if ssh process was terminated using a signal)

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname && exit 3');
await ssh.run();
console.log(`state: ${JSON.stringify(ssh.state)}`);
```

### Ssh.pid

`.pid`

Returns the pid of ssh process

**return** *integer*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'hostname');
const p = ssh.run();
console.log(`pid = ${ssh.pid}`);
await p;
```

### Ssh.context

`.context`

Retrieves the context which was passed in constructor

**return** *any*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2', {
  context:{id:1}
});
await ssh.run();
console.log(JSON.stringify(ssh.context));
```

### Ssh.duration

`.duration`

Retrieves the duration of the session in milliseconds 

**return** *integer*

<u>Example</u>

```js
const ssh = new Ssh(`root@test:2222`, 'sleep 2');
await ssh.run();
console.log(JSON.stringify(ssh.duration));
```

### Ssh.out

`Ssh.out`

Gets `std.out` stream wrapper

<u>Example</u>

```js
Ssh.out.puts(`stdout output`);
```

### Ssh.err

`Ssh.err`

Gets `std.err` stream wrapper

<u>Example</u>

```js
Ssh.err.puts(`stderr output`);
```

## sshExec(...)

`sshExec(host, cmd, opt)`

Executes a command and return the content of *stdout*

* **host** (*string*) : host to connec to. Format can be one of
  * hostname
  * user@hostname
  * hostname:port
  * user@hostname:port
* **cmd** (*string*) : remote command (cannot be *empty*)   
* opt (*object*) : options
  * opt.port (*integer*) : remote port (default = `22`)
  * opt.user (*string*) : login user (defaults to current user)
  * opt.checkHostKey (*boolean*) : whether or not host key should be  checked (default = `false`)
  * opt.connectTimeout (*integer*) : maximum number of seconds allowed for connection
  * opt.identityFile (*string*) : full path to identify file (can be used to bypass agent)
  * opt.env (*object*) dictionary of environment variables to define on remote host
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout* (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`) (does not apply to *stdout* & *stderr* event listeners)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.context (*any*) : user define context (can be used to identify ssh requests later by client code)
  * opt.ignoreError (*boolean*) : if `true` promise will resolve to the content of stdout even if an error occured

**return** *Promise* which resolves to the content of *stdout*

In case child process failed, an exception will be triggered, using the content of *stderr* as message

Following extra properties will be added to the exception

* `state` *object* as returned by `Ssh.state` property
* `sshError` *string* (will be `undefined` if there was no *ssh* error)
* `sshErrorReason` *string* (will be `undefined` if there was no *ssh* error)

<u>Example</u>

```js
    try {
        const str = await sshExec('root@test:2222', 'hostname');
        console.log(`stdout = ${str}`);
    }
    catch (e) {
        if (undefined !== e.sshError) {
            console.log(`ssh error: ${e.sshError} (${e.sshErrorReason})`);
        }
        else {
            console.log(`stderr: ${e.message}`);
            console.log(JSON.stringify(e.state));
        }
    }
```

## multiSsh

`multiSsh(list)`

Run multiple Ssh objects and return when all sessions are finished

* **list** *Ssh[]* : array of `Ssh` *objects*

**return** *Promise* which resolved to an *object[]* where each *object* has following properties

* result (*boolean*) : whether or not session failed (same as the result of `Ssh.run()`)
* ssh (*Ssh*) : `Ssh` *object*

<u>Example</u>

```js
const cmdList = [
    'hostname',
    'date',
    'uptime'
];
const list = [];
for (let i = 0; i < 3; ++i) {
    list.push(new Ssh('root@test:2222', cmdList[i]));
}
const responses = (await multiSsh(list)).map((e => e.ssh.stdout));
console.log(JSON.stringify(responses, null, 4));
```

## SshAgent

Can be used to manage ssh identities using *ssh-agent* binary

### SshAgent.isRunning(...)

`SshAgent.isRunning()`

Check whether or not *ssh-agent* is running

**return** *boolean*

<u>Example</u>

```js
const isRunning = await SshAgent.isRunning();
console.log(`isRunning: ${isRunning}`);
```

### SshAgent.listIdentities(...)

`SshAgent.listIdentities()`

List loaded identities

**return** *object[]* where each object has following properties

* format (*string*) : public key format (ex: `ssh-rsa`)
* data (*string*) : public key data
* file (*string*) : full path to private key

<u>Example</u>

```js
const list = await SshAgent.listIdentities();
console.log(JSON.stringify(list, null, 2));
```

### SshAgent.checkIdentity(...)

`SshAgent.checkIdentity(file)`

Checks whether or not an identity is loaded

* **file** (*string*) : absolute path to *SSH* key

**return** *boolean*

<u>Example</u>

```js
const isLoaded = await SshAgent.checkIdentity('/root/.ssh/id_rsa');
console.log(`isLoaded: ${isLoaded}`);
```

### SshAgent.addIdentity(...)

`SshAgent.addIdentity(file, opt)`

Adds an identity to *SSH* agent

* **file** (*string*) : absolute path to *SSH* key
* opt (*object*) : options
  * opt.checkFirst (*boolean*) : if `true`, identity won't be added if it is already loaded
  * opt.expiry (*integer*) : maximum lifetime in seconds (no expiry by default, will be ignored if `opt.checkFirst` is `true`)
  
**return** *boolean* `true` if identity was added, `false` otherwise
**throws** `Error` in case of failure (ex: *ssh-agent* not running)

<u>Example</u>

```js
const result = await SshAgent.addIdentity('/root/.ssh/id_rsa', {checkFirst:true, expiry:10});
console.log(`result: ${result}`);
```

### SshAgent.addDefaultIdentities(...)

`SshAgent.addDefaultIdentities()`

Add default identities (~/.ssh/id_rsa, ~/.ssh/id_dsa...) to *SSH* agent

* opt (*object*) : options
  * opt.expiry (*integer*) : maximum lifetime in seconds (no expiry by default)
  
<u>Example</u>

```js
await SshAgent.addDefaultIdentities({expiry:10});
const list = await SshAgent.listIdentities();
console.log(JSON.stringify(list));
```

### SshAgent.removeIdentity(...)

`SshAgent.removeIdentity(file)`

Removes an identity from *SSH* agent

* **file** (*string*) : absolute path to *SSH* key
  
**return** *boolean* `true` if identity existed and was removed, `false` otherwise

<u>Example</u>

```js
const result = await SshAgent.removeIdentity('/root/.ssh/id_rsa');
console.log(`result: ${result}`);
```

### SshAgent.removeDefaultIdentities(...)

`SshAgent.removeDefaultIdentities()`

Remove default identities (~/.ssh/id_rsa, ~/.ssh/id_dsa...) from *SSH* agent

<u>Example</u>

```js
await SshAgent.removeDefaultIdentities();
const list = await SshAgent.listIdentities();
console.log(JSON.stringify(list));
```

### SshAgent.removeAllIdentities(...)

`SshAgent.removeAllIdentities()`

Remove all identities from *SSH* agent

<u>Example</u>

```js
await SshAgent.removeAllIdentities();
const list = await SshAgent.listIdentities();
console.log(JSON.stringify(list));
```
