# version

Helpers to perform semver versions comparison

It only accept versions matching `x.y.z` where `x`, `y` and `z` are *integers* and will throw an exception in case an invalid version is passed

## version.VERSSION

`version.VERSION`

Retrieves library version

**return** *string* : version of the library

<u>Example</u>

```js
console.log(version.VERSION);
```

## version.eq

`version.eq(current, target)`

Checks whether or not two versions are equal

* **[current]** (*string*) : version to check
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.eq('1.0.0', '1.0.0');
console.log(result);
result = version.eq('1.0.1', '1.0.0');
console.log(result);
```

## version.neq

`version.neq(current, target)`

Checks whether or not two versions are distinct

* **[current]** (*string*) : version to compare
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.neq('1.0.0', '1.0.1');
console.log(result);
result = version.neq('1.0.1', '1.0.1');
console.log(result);
```

## version.lt

`version.lt(current, target)`

Checks if a given version is less than another version

* **[current]** (*string*) : version to compare
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.lt('1.0.0', '1.0.1');
console.log(result);
result = version.lt('1.0.1', '1.0.1');
console.log(result);
result = version.lt('1.0.2', '1.0.1');
console.log(result);
```

## version.lte

`version.lte(current, target)`

Checks if a given version is less than or equal to another version

* **[current]** (*string*) : version to compare
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.lte('1.0.0', '1.0.1');
console.log(result);
result = version.lte('1.0.1', '1.0.1');
console.log(result);
result = version.lte('1.0.2', '1.0.1');
console.log(result);
```

## version.gt

`version.gt(current, target)`

Checks if a given version is greater than another version

* **[current]** (*string*) : version to compare
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.gt('1.0.2', '1.0.1');
console.log(result);
result = version.gt('1.0.1', '1.0.1');
console.log(result);
result = version.gt('1.0.0', '1.0.1');
console.log(result);
```

## version.gte

`version.gte(current, target)`

Checks if a given version is greater than or equal to another version

* **[current]** (*string*) : version to compare
* target (*string*) : version to compare to (default = library version)

<u>Example</u>

```js
let result;
result = version.gte('1.0.2', '1.0.1');
console.log(result);
result = version.gte('1.0.1', '1.0.1');
console.log(result);
result = version.gte('1.0.0', '1.0.1');
console.log(result);
```
