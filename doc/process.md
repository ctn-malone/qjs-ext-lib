<!-- omit in toc -->
# process

Executes external processes asynchronously and returns an object (named `ProcessState` afterward), with following properties

* pid (*integer*) : process pid
* exitCode (*integer*) : exit code of the process
* didTimeout (*boolean*) : whether or not process was killed after timeout
* signal (*string*) : signal name (only defined if process was terminated using a signal)

<u>Example</u>

```json
{
    "pid":366808,
    "exitCode":-15,
    "didTimeout":false,
    "signal":"SIGTERM"
}
```

- [Process](#process-1)
  - [Process.constructor(...)](#processconstructor)
  - [Process.getSignalName(...)](#processgetsignalname)
  - [Process.run(...)](#processrun)
  - [Process.wait(...)](#processwait)
  - [Process.pause(...)](#processpause)
  - [Process.resume(...)](#processresume)
  - [Process.kill(...)](#processkill)
  - [Process.cmdline](#processcmdline)
  - [Process.stdout](#processstdout)
  - [Process.stderr](#processstderr)
  - [Process.paused](#processpaused)
  - [Process.state](#processstate)
  - [Process.success](#processsuccess)
  - [Process.pid](#processpid)
  - [Process.props](#processprops)
  - [Process.setEventListener(...)](#processseteventlistener)
- [exec(...)](#exec)
- [waitpid(...)](#waitpid)
- [ProcessSync](#processsync)
  - [ProcessSync.constructor(...)](#processsyncconstructor)
  - [ProcessSync.getSignalName(...)](#processsyncgetsignalname)
  - [ProcessSync.run(...)](#processsyncrun)
  - [ProcessSync.cmdline](#processsynccmdline)
  - [ProcessSync.stdout](#processsyncstdout)
  - [ProcessSync.stderr](#processsyncstderr)
  - [ProcessSync.exitCode](#processsyncexitcode)
  - [ProcessSync.success](#processsyncsuccess)
  - [ProcessSync.props](#processsyncprops)
- [execSync(...)](#execsync)
- [ensureProcessResult(...)](#ensureprocessresult)

## Process

### Process.constructor(...)

`new Process(cmdline, opt)`

Constructor

* **cmdline** (*string|string[]*) : command line to execute
* opt (*object*) : options
  * opt.usePath (*boolean*) : if `true`, the command will be searched using `PATH` environment variable (default = `true`)
  * opt.cwd (*string*) : set the working directory of the new process
  * opt.uid (*integer*) : if defined, process uid will be set using `setuid`
  * opt.gid (*integer*) : if defined, process gid will be set using `setgid`
  * opt.env (*object*) : define child process environment (if not defined, use the environment of parent process)
  * opt.replaceEnv (*boolean*) : if `true`, ignore parent environment when setting child environment (default = `true`)
  * opt.useShell (*boolean*) : if `true`, run command using `/bin/sh -c` (default = `false`)
  * opt.shell (*string*) : full path to shell (default = `/bin/sh`, ignored if `opt.useShell` is `false`)
  * opt.newSession (*boolean*) : if `true` `setsid` will be used (ie: child will not receive `SIGINT` sent to parent) (default = `false`)
  * opt.passStderr (*boolean*) : if `true` stderr will not be intercepted (default = `false`)
    - ignored if `opt.stdout` is set
    - ignored if `opt.streamStdout` is `false`
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout* (default = `false`)
    - ignored if `opt.stdout` is set
    - ignored if `opt.streamStdout` is `false`
    - ignored if `opt.passStderr` is `true`
  * opt.lineBuffered (*boolean*) : if `true` call *stdout* & *stderr* event listeners only after a line is complete (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`) (does not apply to *stdout* & *stderr* event listeners)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.timeout (*integer*) :  maximum number of seconds before killing child (if `undefined`, no timeout will be configured)
  * opt.timeoutSignal (*integer*) : signal to use when killing the child after timeout (default = `SIGTERM`, ignored if `opt.timeout` is not defined)
  * opt.stdin (*integer*) : if defined, sets the *stdin* handle used by child process (don't share the same *handle* between multiple instances as it will be automatically rewind !)
  * opt.input (*string*) : content which will be used as input (will be ignored if *stdin* was set)
  * opt.stdout (*integer*) : if defined, sets the *stdout* handle used by child process (don't share the same *handle* between multiple instances as it will be automatically rewind !)
    - *stdout* event handler will be ignored
    - *stderr* redirection will be ignored
    - `opt.passStderr` will be ignored
  * opt.streamStdout (*boolean*) : whether or not streaming should be enabled (default = `true`)
    - ignored if `opt.stdout` is set
    - if `true`
      * stdout event handler will be ignored
      * stderr redirection will be ignored
      * `opt.passStderr` will be ignored
 * opt.bufferSize (*integer*) : size (in bytes) of the buffer used to read from child process streams (default = `512`)
 * opt.props (*object*) : custom properties

<u>Examples</u>

```js
const p = new Process('sleep 10s', {
    timeout: 5
});
await p.run();
```

```js
const p = new Process('md5sum', {
    input: 'Hello world'
});
await p.run();
console.log(`stdout: ${p.stdout}`);
```

### Process.getSignalName(...)

Convert a signal number to a signal name. This is a **static** method

**return** *string|undefined* signal name

<u>Example</u>

```js
const name = Process.getSignalName(2);
console.log(name);
```

### Process.run(...)

`.run()`

Run the child process and return execution result

**return** *Promise<ProcessState>*

<u>Example</u>

```js
const p = new Process('uptime -p');
const state = await p.run();
console.log(JSON.stringify(state));
```

### Process.wait(...)

`.wait()`

Wait until process is terminated. An exception will be thrown if process was not started

**return** *Promise<ProcessState>*

<u>Example</u>

```js
const p = new Process('uptime -p');
p.run();
const state = await p.wait();
console.log(JSON.stringify(state));
```

### Process.pause(...)

`.pause()`

Pause child process

<u>Example</u>

```js
const p = new Process('for i in $(seq 1 5) ; do printf "$i - " ; date ; sleep 1s ; done', {
    useShell:true
});
p.run();
// pause process after 3s
os.setTimeout(() => {
    p.pause();
    console.log(`Process has been paused: paused = ${p.paused}`);
    // resume process after 5s
    os.setTimeout(() => {
        p.resume();
        console.log(`Process has been resumed: paused = ${p.paused}`);
    }, 5000);
}, 3000);
await p.wait();
console.log(p.stdout);
```

### Process.resume(...)

`.resume()`

Resume child process

<u>Example</u>

```js
const p = new Process('for i in $(seq 1 5) ; do printf "$i - " ; date ; sleep 1s ; done', {
    useShell:true
});
p.run();
// pause process after 3s
os.setTimeout(() => {
    p.pause();
    console.log(`Process has been paused: paused = ${p.paused}`);
    // resume process after 5s
    os.setTimeout(() => {
        p.resume();
        console.log(`Process has been resumed: paused = ${p.paused}`);
    }, 5000);
}, 3000);
await p.wait();
console.log(p.stdout);
```

### Process.kill(...)

`.kill(signal)`

Stops child process

* signal (*integer*) : signal to send (default = `os.SIGTERM`)

### Process.cmdline

`.cmdline`

Returns the command line of the child process

**return** *string*

<u>Example</u>

```js
const p = new Process('uptime -p');
console.log(p.cmdline);
await p.run();
```

### Process.stdout

`.stdout`

Returns all output generated by the child process on *stdout*. It will be empty if a *stdout* event listener was defined

**return** *string*

<u>Example</u>

```js
const p = new Process('uptime -p');
await p.run();
console.log(p.stdout);
```

### Process.stderr

`.stderr`

Returns all content generated by the child process on *stderr*. It will be empty if a *stderr* event listener was defined

**return** *string*

<u>Example</u>

```js
const p = new Process('uptime -p 1>&2', {
    useShell:true
});
await p.run();
console.log(p.stderr);
```

### Process.paused

`.paused`

Indicates whether or not child process is paused

**return** *boolean*

<u>Example</u>

```js
const p = new Process('for i in $(seq 1 5) ; do printf "$i - " ; date ; sleep 1s ; done', {
    useShell:true
});
p.run();
// pause process after 3s
os.setTimeout(() => {
    p.pause();
    console.log(`Process has been paused: paused = ${p.paused}`);
    // resume process after 5s
    os.setTimeout(() => {
        p.resume();
        console.log(`Process has been resumed: paused = ${p.paused}`);
    }, 5000);
}, 3000);
await p.wait();
console.log(p.stdout);
```

### Process.state

`.state`

Returns child process state (pid, exitCode ...)

**return** *object* (`ProcessState`)

<u>Example</u>

```js
const p = new Process('uptime -p');
await p.run();
console.log(JSON.stringify(p.state));
```

### Process.success

`.success`

Indicates whether or not child process was successfully executed

**return** *boolean*

<u>Example</u>

```js
const p = new Process('uptime -p');
await p.run();
console.log(p.success);
```

### Process.pid

`.pid`

Returns the pid of the child process

**return** *integer*

<u>Example</u>

```js
const p = new Process('uptime -p');
p.run();
console.log(p.pid);
await p.wait();
```

### Process.props

`.props`

Returns the custom properties passed in constructor

**return** *object*

<u>Example</u>

```js
const p = new Process('uptime -p', {
    props:{cmd:'uptime'}
});
p.run();
console.log(JSON.stringify(p.props));
await p.wait();
```

### Process.setEventListener(...)

`.setEventListener(eventType, cb)`

Defines event listeners. Any previously defined listener will be replaced.

* eventType (*string*) : event to define listener for
* cb (*function*) : callback

Following events are supported :

* stdout : triggered whenever data was generated by child process on *stdout* with a single *object* as argument
  * pid (*integer*) : process pid
  * data (*string*) : output
  * timestamp (*integer*) : js timestamp indicating when output was received
* stderr : triggered whenever data was generated by child process on *stderr* with a single *object* as argument
  * pid (*integer*) : process pid
  * data (*string*) : output
  * timestamp (*integer*): js timestamp js timestamp indicating when output was received
* pause : triggered whenever the process has been pause using `pause` method with a single *object* as argument
  * pid (*integer*) : process pid 
* resume: triggered whenever the process has been resumed using `resume` method with a single *object* as argument
  * pid (*integer*) : process pid 
* exit : triggered once the process has been terminated with a single *object* (`ProcessState`) as argument

<u>Example</u>

```js
/*
    Writes every even number to stdout & every odd number to stderr
 */
const p = new Process('for i in $(seq 1 5) ; do if [ $(($i % 2)) -eq 0 ] ; then echo $i ; else echo $i 1>&2 ; fi ; sleep 1s ; done', {
    useShell:true,
    lineBuffered:true
});
p.setEventListener('stdout', (obj) => {console.log(`[${obj.pid}] stdout: ${obj.data}`)});
p.setEventListener('stderr', (obj) => {console.log(`[${obj.pid}] stderr: ${obj.data}`)});
p.setEventListener('pause', (obj) => {console.log(`[${obj.pid}] was paused`)});
p.setEventListener('resume', (obj) => {console.log(`[${obj.pid}] was resumed`)});
p.setEventListener('exit', (obj) => {console.log(`[${obj.pid}] exited with code ${obj.exitCode}`)});
p.run();
// pause process after 3s
os.setTimeout(() => {
    p.pause();
    // resume process after 5s
    os.setTimeout(() => {
        p.resume();
    }, 5000);
}, 3000);
```

## exec(...)

`exec(cmdline, opt)`

Executes a command and return the content of *stdout*

* **cmdline** (*string|string[]*) : command line to execute
* opt (*object*) : options
  * opt.usePath (*boolean*) : if `true`, the command will be searched using `PATH` environment variable (default = `true`)
  * opt.cwd (*string*) : set the working directory of the new process
  * opt.uid (*integer*) : if defined, process uid will be set using `setuid`
  * opt.gid (*integer*) : if defined, process gid will be set using `setgid`
  * opt.env (*object*) : define child process environment (if not defined, use the environment of parent process)
  * opt.replaceEnv (*boolean*) : if `true`, ignore parent environment when setting child environment (default = `true`)
  * opt.useShell (*boolean*) : if `true`, run command using `/bin/sh -c` (default = `false`)
  * opt.shell (*string*) : full path to shell (default = `/bin/sh`, ignored if `opt.useShell` is `false`)
  * opt.newSession (*boolean*) : if `true` `setsid` will be used (ie: child will not receive `SIGINT` sent to parent) (default = `false`)
  * opt.passStderr (*boolean*) : if `true` stderr will not be intercepted (default = `false`)
    - ignored if `opt.streamStdout` is `false`
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout* (default = `false`)
    - ignored if `opt.streamStdout` is `false`
    - ignored if `opt.passStderr` is `true`
  * opt.lineBuffered (*boolean*) : if `true` call *stdout* & *stderr* event listeners only after a line is complete (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`) (does not apply to *stdout* & *stderr* event listeners)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.timeout (*integer*) :  maximum number of seconds before killing child (if `undefined`, no timeout will be configured)
  * opt.timeoutSignal (*integer*) : signal to use when killing the child after timeout (default = `SIGTERM`, ignored if `opt.timeout` is not defined)
  * opt.stdin (*integer*) : if defined, sets the *stdin* handle used by child process (don't share the same *handle* between multiple instances !)
  * opt.input (*string*) : content which will be used as input (will be ignored if *stdin* was set)
  * opt.streamStdout (*boolean*) : whether or not streaming should be enabled (default = `true`)
    - if `true`
      * stdout event handler will be ignored
      * stderr redirection will be ignored
      * `opt.passStderr` will be ignored
  * opt.ignoreError (*boolean*) : if `true` promise will resolve to the content of stdout even if process exited with a non zero code
  * opt.bufferSize (*integer*) : size (in bytes) of the buffer used to read from child process streams (default = `512`)

**return** *Promise<string>* which resolves to the content of *stdout*

In case child process failed, an exception will be triggered, using the content of *stderr* as message

Following extra properties will be added to the exception

* `state` *object* (`ProcessState`) as returned by `Process.state` property

<u>Examples</u>

```js
const stdout = await exec('uptime -p');
console.log(`stdout: ${stdout}`);
try {
    await exec('uptim -p');
}
catch (e) {
    console.log(`process failed: ${e.message}`);
    console.log(JSON.stringify(e.state));
}
```

```js
const stdout = await exec('md5sum', {
    input: 'Hello world'
});
console.log(`stdout: ${stdout}`);
```

## waitpid(...)

`waitpid(pid, pollDelay)`

Wait asynchronously until a given process is terminated

* **pid** (*integer*) : pid of the process to wait for
* pollDelay (*integer*) : delay in ms between polling (default = `250`)

**return** *Promise<void>* which resolves once the process is gone

## ProcessSync

### ProcessSync.constructor(...)

`new ProcessSync(cmdline, opt)`

Constructor

* **cmdline** (*string|string[]*) : command line to execute
* opt (*object*) : options
  * opt.usePath (*boolean*) : if `true`, the command will be searched using `PATH` environment variable (default = `true`)
  * opt.cwd (*string*) : set the working directory of the new process
  * opt.uid (*integer*) : if defined, process uid will be set using `setuid`
  * opt.gid (*integer*) : if defined, process gid will be set using `setgid`
  * opt.env (*object*) : define child process environment (if not defined, use the environment of parent process)
  * opt.replaceEnv (*boolean*) : if `true`, ignore parent environment when setting child environment (default = `true`)
  * opt.useShell (*boolean*) : if `true`, run command using `/bin/sh -c` (default = `false`)
  * opt.shell (*string*) : full path to shell (default = `/bin/sh`, ignored if `opt.useShell` is `false`)
  * opt.passStderr (*boolean*) if `true` *stderr* will not be intercepted (default = `true`)
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout*, ignored if `opt.passStderr` is `true` or `opt.passStdout` is `true` (default = `false`)
  * opt.passStdout (*boolean*) if `true` *stdout* will not be intercepted (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.stdin (*integer*) : if defined, sets the *stdin* handle used by child process (don't share the same *handle* between multiple instances as it will be automatically rewind !)
  * opt.input (*string*) : content which will be used as input (will be ignored if *stdin* was set)
 * opt.props (*object*) : custom properties

<u>Examples</u>

```js
const p = new ProcessSync('sleep 10s');
p.run();
```

```js
const p = new ProcessSync('md5sum', {
    input: 'Hello world'
});
p.run();
console.log(`stdout: ${p.stdout}`);
```

### ProcessSync.getSignalName(...)

Convert a signal number to a signal name. This is a **static** method

**return** *string|undefined* signal name

<u>Example</u>

```js
const name = ProcessSync.getSignalName(2);
console.log(name);
```

### ProcessSync.run(...)

`.run()`

Run the child process and return whether or not execution succeeded

**return** *Promise<boolean>*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p');
const result = p.run();
console.log(result);
```

### ProcessSync.cmdline

`.cmdline`

Returns the command line of the child process

**return** *string*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p');
console.log(p.cmdline);
p.run();
```

### ProcessSync.stdout

`.stdout`

Returns all output generated by the child process on *stdout*

**return** *string*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p');
p.run();
console.log(p.stdout);
```

### ProcessSync.stderr

`.stderr`

Returns all content generated by the child process on *stderr*

**return** *string*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p 1>&2', {
    useShell:true
});
p.run();
console.log(p.stderr);
```

### ProcessSync.exitCode

`.exitCode`

Returns the exit code of the child process

**return** *integer*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p');
p.run();
console.log(p.exitCode);
```

### ProcessSync.success

`.success`

Indicates whether or not child process was successfully executed

**return** *boolean*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p');
p.run();
console.log(p.success);
```

### ProcessSync.props

`.props`

Returns the custom properties passed in constructor

**return** *object*

<u>Example</u>

```js
const p = new ProcessSync('uptime -p', {
    props:{cmd:'uptime'}
});
p.run();
console.log(JSON.stringify(p.props));
```

## execSync(...)

`execSync(cmdline, opt)`

Executes a command synchronously and return the content of *stdout*

* **cmdline** (*string|string[]*) : command line to execute
* opt (*object*) : options
  * opt.usePath (*boolean*) : if `true`, the command will be searched using `PATH` environment variable (default = `true`)
  * opt.cwd (*string*) : set the working directory of the new process
  * opt.uid (*integer*) : if defined, process uid will be set using `setuid`
  * opt.gid (*integer*) : if defined, process gid will be set using `setgid`
  * opt.env (*object*) : define child process environment (if not defined, use the environment of parent process)
  * opt.replaceEnv (*boolean*) : if `true`, ignore parent environment when setting child environment (default = `true`)
  * opt.useShell (*boolean*) : if `true`, run command using `/bin/sh -c` (default = `false`)
  * opt.shell (*string*) : full path to shell (default = `/bin/sh`, ignored if `opt.useShell` is `false`)
  * opt.redirectStderr (*boolean*) : if `true` *stderr* will be redirected to *stdout*, ignored if `opt.passStderr` is `true` or `opt.passStdout` is `true` (default = `false`)
  * opt.passStdout (*boolean*) if `true` *stdout* will not be intercepted (default = `false`)
  * opt.trim (*boolean*) : if `true` *stdout* & *stderr* content will be trimmed (default = `true`)
  * opt.skipBlankLines (*boolean*) : if `true` empty lines will be ignored in both *stdout* & *stderr* content (default = `false`)
  * opt.stdin (*integer*) : if defined, sets the *stdin* handle used by child process (don't share the same *handle* between multiple instances as it will be automatically rewind !)
  * opt.input (*string*) : content which will be used as input (will be ignored if *stdin* was set)
  * opt.ignoreError (*boolean*) : if `true` promise will resolve to the content of stdout even if process exited with a non zero code

**return** *string* content of stdout in case process exited with zero or `opt.ignoreError` is `true`

In case child process failed, an exception will be triggered, using the content of *stderr* as message

Following extra properties will be added to the exception

* `exitCode` *integer*

<u>Examples</u>

```js
const stdout = execSync('uptime -p');
console.log(`stdout: ${stdout}`);
try {
    execSync('uptim -p');
}
catch (e) {
    console.log(`process failed: ${e.message}`);
    console.log(e.exitCode);
}
```

```js
const stdout = execSync('md5sum', {
    input: 'Hello world'
});
console.log(`stdout: ${stdout}`);
```

## ensureProcessResult(...)

`ensureProcessResult(process)`

Ensures a process executed successfully (ie: exit code == 0) and throws an error if not

* **process** (*Process|ProcessSync*) : process to check result for

In case child process failed, an exception will be triggered, using the content of *stderr* as message

Following extra properties will be added to the exception

- If process is a `Process`
  * `state` *object* (`ProcessState`) as returned by `Process.state` property

- If process is a `ProcessSync`
  * `exitCode` *integer*

```js
const process = new Process('ls -invalid');
await process.run();
// will throw an error
ensureProcessResult(process);
```
