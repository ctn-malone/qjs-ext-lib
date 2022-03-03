# version

Helpers to perform semver versions comparison

It only accept versions matching `x.y.z-p+m` where 
  * `x`, `y` and `z` are *integers*
  * `p` is a pre-release version (dot separated list of `[0-9A-Za-z-]+` identifiers)
  * `m` contains metadata (dot separated list of `[0-9A-Za-z-]+` identifiers)

It will throw an exception in case an invalid version is passed

## version.VERSION

`version.VERSION`

Retrieves library version

**return** *string* : version of the library

<u>Example</u>

```js
console.log(version.VERSION);
```

## version.isSemver

`version.isSemver(version)`

Checks whether or not a given version matches semver format

* **[version]** (*string*) : version to check

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.isSemver('1.0.0');
console.log(result);
result = version.isSemver('1.0.0-0.3.7+exp.sha.5114f85');
console.log(result);
result = version.isSemver('1.0.0a');
console.log(result);
```

## version.convert

`version.convert(version)`

Tries to convert a string to semver format

* **[version]** (*string*) : version to convert

**return** *string|undefined* will return `undefined` if `version` does not start with `x.y.z`

<u>Example</u>

```js
let result;
result = version.convert('1.0.0a');
console.log(result);
result = version.convert('1.0.0-alpha');
console.log(result);
result = version.convert('1.0a@b');
console.log(result);
```

## version.eq

`version.eq(target, current)`

Checks whether or not two versions are equal

* **[target]** (*string*) : version to compare to
* current (*string*) : version to compare (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.eq('1.0.0', '1.0.0');
console.log(result);
result = version.eq('1.0.0', '1.0.1');
console.log(result);
```

## version.neq

`version.neq(target, current)`

Checks whether or not two versions are distinct

* **[target]** (*string*) : version to compare to
* current (*string*) : version to check (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.neq('1.0.1', '1.0.0');
console.log(result);
result = version.neq('1.0.1', '1.0.1');
console.log(result);
```

## version.lt

`version.lt(target, current)`

Checks if a given version is less than another version

* **[target]** (*string*) : version to compare to
* current (*string*) : version to check (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.lt('1.0.1', '1.0.0');
console.log(result);
result = version.lt('1.0.1', '1.0.1');
console.log(result);
result = version.lt('1.0.1', '1.0.2');
console.log(result);
```

## version.lte

`version.lte(target, current)`

Checks if a given version is less than or equal to another version

* **[target]** (*string*) : version to compare to
* current (*string*) : version to check (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.lte('1.0.1', '1.0.0');
console.log(result);
result = version.lte('1.0.1', '1.0.1');
console.log(result);
result = version.lte('1.0.1', '1.0.2');
console.log(result);
```

## version.gt

`version.gt(target, current)`

Checks if a given version is greater than another version

* **[target]** (*string*) : version to compare to
* current (*string*) : version to check (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.gt('1.0.1', '1.0.2');
console.log(result);
result = version.gt('1.0.1', '1.0.1');
console.log(result);
result = version.gt('1.0.1', '1.0.0');
console.log(result);
```

## version.gte

`version.gte(target, current)`

Checks if a given version is greater than or equal to another version

* **[target]** (*string*) : version to compare to
* current (*string*) : version to check (default = library version)

**return** *boolean*

<u>Example</u>

```js
let result;
result = version.gte('1.0.1', '1.0.2');
console.log(result);
result = version.gte('1.0.1', '1.0.1');
console.log(result);
result = version.gte('1.0.1', '1.0.0');
console.log(result);
```
