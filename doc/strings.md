# strings

Strings helpers

## base64EncodeStr(...)

Encode a plain string to a base64 string

* **plainStr** (*string*) : string to encode

**return** *Promise<string>*

<u>Example</u>

```js
import * as strings from 'ext/strings.js';

const main = async () => {
  const plainStr = 'This is a plain string';
  const base64Str = await strings.base64EncodeStr(plainStr);
  console.log(base64Str);
}
main();
```

## base64DecodeStr(...)

Decode a base64 string as a plain string

* **base64Str** (*string*) : base64 string to decode

**return** *Promise<string>*

<u>Example</u>

```js
import * as strings from 'ext/strings.js';

const main = async () => {
  const base64Str = 'VGhpcyBpcyBhIHBsYWluIHN0cmluZw==';
  const plainStr = await strings.base64DecodeStr(base64Str);
  console.log(plainStr);
}
main();
```

## base64EncodeBytesArray(...)

Encode a *Uint8Array* to a base64 string

* **bytesArray** (*Uint8Array*) : bytes array to encode

**return** *Promise<string>*

<u>Example</u>

```js
import * as strings from 'ext/strings.js';

const main = async () => {
  const bytesArray = new Uint8Array(10);
  for (let i = 0; i < 10; ++i) {
    bytesArray[i] = i;
  }
  const base64Str = await strings.base64EncodeBytesArray(bytesArray);
  console.log(base64Str);
}
main();
```

## base64EncodeBytesArray(...)

Decode a base64 string as a *Uint8Array*

* **base64Str** (*string*) : base64 string to decode

**return** *Promise<Uint8Array>*

<u>Example</u>

```js
import * as strings from 'ext/strings.js';

const main = async () => {
  const base64Str = 'AAECAwQFBgcICQ==';
  const bytesArray = await strings.base64DecodeBytesArray(base64Str);
  console.log(bytesArray);
}
main();
```

