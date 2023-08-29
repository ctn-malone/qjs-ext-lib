# password-store

## checkPassword(...)

Check whether or not a password exists

`checkPassword(passwordPath)`

* **[passwordPath]** (*string*) : path relative to the password store

**return** *boolean* whether or not password exists

<u>Example</u>

```js
checkPassword('email/gmail1'); 
```

## getPassword(...)

Retrieve a password

`getPassword(passwordPath, opt)`

* **[passwordPath]** (*string*) : path relative to the password store
* opt (*object*) : options
  * opt.json (*boolean*) : if `true`, password will be JSON parsed (default = `false`)
  * opt.lineNumber (*number*) : if set, only this line (0 based) will be returned (default = `undefined`)
    * Will be ignored if `opt.json` is `true`

**return** *object|string|undefined*

<u>NB</u> : if content cannot be JSON parsed, password content will be returned as a `string`

<u>Example</u>

```js
const payload = await getPassword('email/gmail1', {json: true});
if (!payload) {
    console.log('Password does not exist');
    std.exit(1);
}
const  { username, password } = payload;
console.log(`username = ${username}, password = ${password}`);
```
