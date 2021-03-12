# timers

## wait(...)

Promisified *wait* function

`wait(delay)`

* **[delay]** (*integer*) : delay in ms

**return** *Promise* which will resolve after delay

<u>Example</u>

```js
await wait(5000); 
```

## setInterval(...)

Schedules repeated execution of a callback every delay milliseconds

`setInterval(cb, interval)`

* **[cb]** (*function*) : callback to call
* **[interval]** (*integer*) : interval in ms

**return** *object* : timer to use with `clearInterval`

<u>Example</u>

```js
const timer = setInterval(() => {
    console.log(Date.now());
}, 1000); 
```

## clearInterval(...)

Cancels a timer created by `setInterval`

`clearInterval(timer)`

* **[timer]** (*object*) : timer created by `setInterval`

<u>Example</u>

```js
const timer = setInterval(() => {
    console.log(Date.now());
}, 1000);

clearInterval(timer);
```
