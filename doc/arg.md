<!-- omit in toc -->
# arg

Command-line parser based on https://github.com/vercel/arg/tree/5.0.0

**TOC**
- [ArgParser](#argparser)
  - [constructor](#constructor)
  - [ArgParser.desc(...)](#argparserdesc)
  - [ArgParser.ver(...)](#argparserver)
  - [ArgParser.ex(...)](#argparserex)
  - [ArgParser.parse(...)](#argparserparse)
  - [ArgParser.parseAsync(...)](#argparserparseasync)
- [ArgValidator](#argvalidator)
  - [StringArgValidator](#stringargvalidator)
    - [StringArgValidator.trim(...)](#stringargvalidatortrim)
    - [StringArgValidator.reg(...)](#stringargvalidatorreg)
    - [StringArgValidator.min(...)](#stringargvalidatormin)
    - [StringArgValidator.max(...)](#stringargvalidatormax)
    - [StringArgValidator.fmt(...)](#stringargvalidatorfmt)
    - [StringArgValidator.enum(...)](#stringargvalidatorenum)
    - [Register new formats](#register-new-formats)
  - [PathArgValidator](#pathargvalidator)
    - [PathArgValidator.check(...)](#pathargvalidatorcheck)
    - [PathArgValidator.checkParent(...)](#pathargvalidatorcheckparent)
    - [PathArgValidator.dir(...)](#pathargvalidatordir)
    - [PathArgValidator.ensure(...)](#pathargvalidatorensure)
    - [PathArgValidator.ensureParent(...)](#pathargvalidatorensureparent)
    - [PathArgValidator.read(...)](#pathargvalidatorread)
    - [PathArgValidator.std(...)](#pathargvalidatorstd)
  - [NumberArgValidator](#numberargvalidator)
    - [NumberArgValidator.pos(...)](#numberargvalidatorpos)
    - [NumberArgValidator.neg(...)](#numberargvalidatorneg)
    - [NumberArgValidator.min(...)](#numberargvalidatormin)
    - [NumberArgValidator.max(...)](#numberargvalidatormax)
    - [NumberArgValidator.int(...)](#numberargvalidatorint)
  - [FlagArgValidator](#flagargvalidator)
    - [FlagArgValidator.no(...)](#flagargvalidatorno)
    - [FlagArgValidator.count(...)](#flagargvalidatorcount)
  - [ArgValidator](#argvalidator-1)
    - [ArgValidator.def(...)](#argvalidatordef)
    - [ArgValidator.env(...)](#argvalidatorenv)
    - [ArgValidator.desc(...)](#argvalidatordesc)
    - [ArgValidator.err(...)](#argvalidatorerr)
    - [ArgValidator.val(...)](#argvalidatorval)
    - [ArgValidator.req(...)](#argvalidatorreq)
    - [ArgValidator.cust(...)](#argvalidatorcust)
    - [ArgValidator.map(...)](#argvalidatormap)
    - [ArgValidator.clone(...)](#argvalidatorclone)
    - [ArgValidator.comp(...)](#argvalidatorcomp)
- [Describe usage](#describe-usage)
- [Shell completion](#shell-completion)
  - [Completion functions](#completion-functions)
    - [bash](#bash)
    - [zsh](#zsh)
- [Faq](#faq)
  - [Does it support sub commands ?](#does-it-support-sub-commands-)
  - [Does it support completion](#does-it-support-completion)

<u>Example</u>

```js
import arg from 'ext/arg.js';

const MOODS = ['happy', 'hangry', 'bored'];

const args = arg
  .parser({
    '--email': arg.str().fmt('email').req().desc('user email'),
    '--mood': arg.str('happy').enum(MOODS).desc('greeting mood'),
    '--random': arg.flag().desc('choose a random mood'),
    '--intensity': [arg.flag().no(false).count().desc('increase intensity')],
    '-e': '--email',
    '-m': '--mood',
    '-i': '--intensity',
  })
  .desc('Greeting program example')
  .ex([
    '-e john@gmail.com -m happy',
    '--email jane@gmail.com -iii',
    '--email john@gmail.com --random'
  ])
  .ver('0.1.0')
  .parse();

let mood = args.get('--mood');
if (args.get('--random')) {
  const index = Math.floor(Math.random() * MOODS.length);
  mood = MOODS[index];
}
let message = `Hello ${args.get('--email')}. I am `;
if (args.get('--intensity') > 0) {
  for (let i = 0; i < args.get('--intensity'); ++i) {
    if (i > 0) {
      message += '-';
    }
    message += 'very';
  }
  message += ' ';
}
message += `${mood} today.`

console.log(message);
```

Running program with `--help` will produce following output

```
Greeting program example

Usage: greet [ARG] ...

  -e, --email EMAIL (*)    : user email
  -m, --mood VAL           : greeting mood (default: happy)
                               - it can be one of [happy, hangry, bored]
  --(no-)random            : choose a random mood
  -i, --intensity (+)      : increase intensity
                               - it can be set multiple times
  -h, --help               : print help
  --version                : print version

EXAMPLES

$ greet -e john@gmail.com -m happy

$ greet --email jane@gmail.com -iii

$ greet --email john@gmail.com --random
```

## ArgParser

### constructor

`arg.parser(validators)`

An `ArgParser` is instanciated using the `arg.parser` function. It takes a `Record<string, ArgValidator|ArgValidator[]>` where

- each key is the command line argument (ex: `--email`)
- each value is an `ArgValidator` object (or `ArgValidator[]` if setting the argument multiple times if possible)

<u>Example</u>

```js
const parser = arg.parser({
  '--name': arg.str().req(),
});
```

### ArgParser.desc(...)

`.desc(description)`

Defines the program description (displayed when `--help` flag is used)

* **description** (*string*) : program description

**returns** *self*

<u>Example</u>

```js
const parser = arg.parser({
  '--name': arg.str().req(),>
}).desc('This is a program');
```

### ArgParser.ver(...)

`.ver(version)`

Defines the version (displayed when `--version` flag is used)

* **version** (*string*) : program version

**returns** *self*

<u>Example</u>

```js
const parser = arg.parser({
  '--name': arg.str().req(),
}).ver('0.1.0');
```

### ArgParser.ex(...)

`.ex(examples)`

Sets examples (displayed when `--help` flag is used)

* **examples** (*string[]*) : examples to display in help

**returns** *self*

<u>Example</u>

```js
const parser = arg.parser({
  '--name': arg.str().req(),
}).ex([
  '--name john'
]);
```

### ArgParser.parse(...)

`.parse(opt)`

Parses and validates command-line arguments

* opt (*ArgParserOptions*) : options

**returns** *Record<string, any>* (parsed arguments)

- if validation fail (missing required argument or invalid argument), program will display usage and exit with an error code (`2`)
- if program is called with `--help` flag, it will display help and exit without error code (`0`)
- if program is called with `--version` flag (and a version has been defined), it will display the version and exit without error code

<u>Types definition</u>

```js
/**
 * @typedef {Object} ArgUsageLayoutOptions
 * @property {number} [maxLength=110] - maximum length of a line
 * @property {number} [argNameIndent=4] - number of spaces before argument names
 * @property {number} [usageIndent=4] - number of spaces between argument names and usage
 * @property {boolean} [ignoreTtySize=false] - if true, don't adapt maximum length to tty size
 */

/**
 * @typedef {Object} ArgParserOptions
 * @property {ArgUsageLayoutOptions} [usageLayout]
 * @property {string[]} [helpFlags=["--help","-h"]] - list of flags to display help
 * @property {string[]} [versionFlags=["--version"]] - list of flags to display version
 * @property {boolean} [capitalizeUsage=false] - if set to true, capitalize usage for --help and --version messages
 * @property {string} [scriptName] - script name to use when displaying usage
 */
```

<u>Example</u>

```js
const args = arg.parser({
  '--name': arg.str().req(),
}).parse({ usageLayout: { maxLength: 80 } });
```

### ArgParser.parseAsync(...)

Same as [ArgParser.parse](#argparserparse) but return a _Promise_ instead

```js
const args = await arg.parser({
  '--name': arg.str().req(),
}).parseAsync({ usageLayout: { maxLength: 80 } });
```

## ArgValidator

`ArgValidator` is an abstract class inspired by [Joi](https://github.com/hapijs/joi) with following inherited classes

- `StringArgValidator` which supports
  * enum validation
  * string length validation
  * regexp validation
  * format validation (ex: email)
  * trimming
- `PathArgValidator` which supports
  * file/directory validation
  * automatic file/directory creation
  * json content validation
- `NumberArgValidator` which supports
  * positive/negative validation
  * range validation
  * integer validation
- `FlagArgValidator` which supports
  * counting the number occurrences of a flag
  * both `--xx` and `--no-xx` flags
  
All `ArgValidator` inherited classes also support
- setting a default value
- marking an argument as required
- retrieving the value using an environment variable
- defining custom validator
- defining a function to map result (once value has been successfully validated)
- defining custom completion function

In order to indicate that an argument can be set multiple times, the validator should be wrapped in an array

<u>Examples</u>

In below example, argument `--num` can be set only once (only the last value will be kept)

```js
const args = arg
  .parser({
    '--num': arg.num().pos().int(),
  })
  .parse();
/*
  $ program --num 5 --num 6
  => 6
 */
console.log(JSON.stringify(args.get('--num')));
```

In below example, argument `--num` can be set multiple times

```js
const args = arg
  .parser({
    '--num': [arg.num().pos().int()],
  })
  .parse();
/*
  $ program --num 5 --num 6
  => [5,6]
 */
console.log(JSON.stringify(args.get('--num')));
```

### StringArgValidator

#### StringArgValidator.trim(...)

`.trim(trimContent = true)`

Indicates whether or not argument value should be trimmed

* trimContent (*boolean*) : (default = `true`)

**returns** *self*

<u>Example</u>

```js
const args = arg.parser({
  '--name': arg.str().trim(),
}).parse();
```

#### StringArgValidator.reg(...)

`.reg(regexp)`

Indicates argument value should match a regular expression

* **regexp** (*RegExp*)

**returns** *self*

<u>Example</u>

Below example accepts `john`, `john1` and `john2`

```js
const args = arg
  .parser({
    '--name': arg.str().reg(/^john[12]?$/),
  })
  .parse();
```

#### StringArgValidator.min(...)

`.min(minLength)`

Defines the minimum length of the argument value

* **minLength** (*number*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--pass': arg.str().req().min(20),
  })
  .parse();
```

#### StringArgValidator.max(...)

`.max(maxLength)`

Defines the maximum length of the argument value

* **maxLength** (*number*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--pass': arg.str().req().max(25),
  })
  .parse();
```

#### StringArgValidator.fmt(...)

`.fmt(formatName)`

Ensures argument value matches a given format (ex: `email`)

* **formatName** (*string*)

**returns** *self*

<u>NB</u> : new formats can be added using `arg.registerFormat(...)`

<u>Example</u>

```js
const args = arg
  .parser({
    '--email': arg.str().fmt('email'),
  })
  .parse();
```

#### StringArgValidator.enum(...)

`.enum(possibleValues, message)`

Defines the list of possible values

* **possibleValues** (*string[]*)
* message (*string*) : message to display before enum values in usage (default = `it can be one of`)

<u>NB</u> : possible values will be listed in usage

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--cmd': arg.str().enum(['date', 'uptime']),
  })
  .parse();
```

#### Register new formats

`arg.registerFormat(...)` can be used to register new string formats, which can be used by `StringArgValidator.fmt(...)` function

<u>Examples</u>

Below example registers a new format using a *RegExp*

```js
arg.registerFormat('test', /^test1|test2$/);
const args = arg
  .parser({
    '--val': arg.str().fmt('test'),
  })
  .parse();
```

Below example registers a new format using a *FormatValidatorFunc*

```js
/**
 * @callback FormatValidatorFunc
 * @param {string} argValue
 *
 * @returns {boolean}
 */
```

```js
arg.registerFormat('test', (value) => {
  return ['test1', 'test2'].includes(value);
});
const args = arg
  .parser({
    '--val': arg.str().fmt('test'),
  })
  .parse();
```

### PathArgValidator

#### PathArgValidator.check(...)

`.check(shouldExist = true)`

Indicates whether or not path should exists

* shouldExist (*boolean*) (default = `true`)

**returns** *self*

<u>Examples</u>

Below example returns an error if path does not exist

```js
const args = arg
  .parser({
    '-p': arg.path().check(),
  })
  .parse();
```

Below example returns an error if path exists

```js
const args = arg
  .parser({
    '-p': arg.path().check(false),
  })
  .parse();
```

#### PathArgValidator.checkParent(...)

`.checkParent()`

Indicates parent directory should exists

**returns** *self*

<u>Example</u>

Below example returns an error if parent directory does not exist

```js
const args = arg
  .parser({
    '-p': arg.path().checkParent(),
  })
  .parse();
```

#### PathArgValidator.dir(...)

`.dir(isDir = true)`

Indicates whether or not path represents a directory

* isDir (*boolean*) (default = `true`)

**returns** *self*

<u>Example</u>

Below example returns an error if path does not exist or is not a directory

```js
const args = arg
  .parser({
    '-d': arg.path().check().dir(),
  })
  .parse();
```

#### PathArgValidator.ensure(...)

`.ensure()`

Ensures path exists and create it (and all its ancestors) if needed

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '-p': arg.path().ensure(),
  })
  .parse();
```

#### PathArgValidator.ensureParent(...)

`.ensureParent()`

Ensures parent directory exists and create it (and all its ancestors) if needed

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '-p': arg.path().ensureParent(),
  })
  .parse();
```

#### PathArgValidator.read(...)

`.read(opt)`

Reads file content at the end of validation

* opt (*object*) : options
  * opt.json (*boolean*) : if `true`, parse the content as *json* (default = `false`)
  * opt.trim (*boolean*) : if `true`, trim the content (default = `false`)

**returns** *self*

<u>NB</u> : if a mapping function has been defined (ie: using `.map(...)`), file content will be passed to it (*string* or *object*)

<u>Example</u>

```js
const args = arg
  .parser({
    '-f': arg.path().read({ json: true }),
  })
  .parse();
console.log(typeof args.get('-f'));
```

#### PathArgValidator.std(...)

`.std(allowStd = true)`

Allows reading from *stdin* and writing to *stdout* using `-`

* allowStd (*boolean*) : (default = `true`)

**returns** *self*

<u>Example</u>

Below example parses the content of *stdin* as *json* and puts the result in `args['-f']`

```js
const args = arg
  .parser({
    '-f': arg.path().std().read({ json: true }),
  })
  .parse();
```

### NumberArgValidator

#### NumberArgValidator.pos(...)

`.pos(isPositive = true)`

Indicates whether or not number should be positive

* isPositive (*boolean*) : (default = `true`)

**returns** *self*

<u>Example</u>

Below example returns an error if argument value is `<= 0`

```js
const args = arg
  .parser({
    '--num': arg.num().pos()
  })
  .parse();
```

#### NumberArgValidator.neg(...)

`.pos(isNegative = true)`

Indicates whether or not number should be negative

* isNegative (*boolean*) : (default = `true`)

**returns** *self*

<u>Example</u>

Below example returns an error if argument value is `>= 0`

<u>NB</u> : program should be called using `--num='-1.5'`, not `--num -1.5`

```js
const args = arg
  .parser({
    '--num': arg.num().neg()
  })
  .parse();
```

#### NumberArgValidator.min(...)

`.min(minValue)`

Defines the minimum argument value

* **minValue** (*number*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--num': arg.num().min(5),
  })
  .parse();
```

#### NumberArgValidator.max(...)

`.max(minValue)`

Defines the maximum argument value

* **maxValue** (*number*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--num': arg.num().max(5),
  })
  .parse();
```

#### NumberArgValidator.int(...)

`.int()`

Indicates that argument value should be an *integer*

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--num': arg.num().int(),
  })
  .parse();
```

### FlagArgValidator

#### FlagArgValidator.no(...)

`.no(allow = true)`

Indicates whether or not `--no-x` flag version should be allowed (allowed by default)

* allow (*boolean*) : (default = `true`)

**returns** *self*

<u>Examples</u>

Below example accepts both `--verbose` and `--no-verbose` flags

```js
const args = arg
  .parser({
    '--verbose': arg.flag()
  })
  .parse();
console.log(`Flag is ${args.get('--verbose') ? 'enabled' : 'disabled'}`);
```

Below example only accepts `--verbose` flag

```js
const args = arg
  .parser({
    '--verbose': arg.flag().no(false)
  })
  .parse();
console.log(`Flag is ${args.get('--verbose') ? 'enabled' : 'disabled'}`);
```

#### FlagArgValidator.count(...)

`.count()`

Returns the number of times flag was set at the end of validation

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '-v': [arg.flag().count()]
  })
  .parse();
console.log(`Flag was set ${args.get('-v')} times`);
```

### ArgValidator

#### ArgValidator.def(...)

`.def(defaultValue)`

Updates default value (can also be defined directly in *constructor*)

* defaultValue (type depends on the validator class)

**returns** *self*

<u>Example</u>

```js
const args = arg.parser({
  '--name': arg.str('john').def('jane'),
}).parse();
```

#### ArgValidator.env(...)

`.env(varName)`

Defines the environment variable to retrieve argument value from

* **varName** (*string*)

**returns** *self*

<u>Example</u>

Below example accepts both `program --name john` and `NAME=john program`

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .env('NAME')
  })
  .parse();
```

#### ArgValidator.desc(...)

`.desc(description)`

Defines the description to use when displaying usage

* **description** (*string*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .desc('user name')
  })
  .parse();
```

#### ArgValidator.err(...)

`.err(message)`

Used to override the error message upon validation failure

* **message** (*string*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--pass': arg
      .str()
      .cust((value) => {
        if(value !== 'password') {
          throw new Error();
        }
      })
      .err('wrong password')
      .desc('user password')
  })
  .parse();
```

#### ArgValidator.val(...)

`.val(text)`

Defines the text which will be displayed after argument names in usage. By default, `VAL` will be used

* **text** (*string*)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .val('NAME')
      .desc('user name')
  })
  .parse();
```

#### ArgValidator.req(...)

`.req(isRequired = true)`

Indicates whether or not an argument is required

* isRequired (*boolean*) : (default = `true`)

**returns** *self*

<u>Example</u>

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .req()
  })
  .parse();
```

#### ArgValidator.cust(...)

`.cust(validatorFn)`

Defines a custom validator

* **validatorFn** (*ValueValidatorFunc*)

**returns** *self*

```js
/**
 * @template [T=string]
 * @callback ValueValidatorFunc
 * @param {T} argValue
 *
 * @returns {false|void}
 */
```

A custom validator is a function which takes the argument value as first argument and returns one of the following

- returns `false` : argument value is valid, subsequent validators will be ignored
- throws an exception : argument value is invalid (exception will be used as error message)
- otherwise : argument value is valid, subsequent validators will be processed

<u>NB</u> : multiple custom validator can be defined

<u>Example</u>

Below example accepts `john`, `jane` or an empty string

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .cust((value) => (!value ? false : undefined))
      .enum(['john', 'jane']),
  })
  .parse();
```

Below example accepts a number `< 5` or `> 6`

```js
const args = arg
  .parser({
    '--num': arg
      .num()
      .cust((value) => {
        if (value < 5 || value > 6) {
          return;
        }
        throw new Error('value should be < 5 or > 6');
      }),
  })
  .parse();
```

#### ArgValidator.map(...)

`.map(mappingFn)`

Defines a mapping function

* **mapperFn** (*ValueMapper*)

**returns** *self*

```js
/**
 * @template T
 * @callback ValueMapper
 * @param {T} argValue
 *
 * @returns {any}
 */
```

A mapping function is a function which takes the argument value as first argument and returns anything

<u>Example</u>

```js
const args = arg
  .parser({
    '--name': arg
      .str()
      .map((value) => ({name: value}))
  })
  .parse();
```

#### ArgValidator.clone(...)

`.clone()`

Clones an existing validator (deep copy)

**returns** *ArgValidator*

<u>Example</u>

```js
const validator1 = arg.str('john').min(4);
const validator2 = validator1.clone().def('jane').min(3);
const args = arg
  .parser({
    '--name1': validator1,
    '--name2': validator2
  })
  .parse();
```

#### ArgValidator.comp(...)

`.comp(completeFn)`

Defines a custom completion function

* **completeFn** (*CustomCompletionFunc*)

**returns** *self*

```js
/**
 * @callback CustomCompletionFunc
 * @param {string} content
 * @param {DefaultCompletionFunc} defaultCompletion
 * @returns {Promise<string[]>}
 */

/**
 * @typedef {() => Promise<string[]>} DefaultCompletionFunc
 */
```

A custom completion function can be used to provide a list of completions for a given `ArgValidator`

<u>Example</u>

```js
const args = arg
  .parser({
    '--age': arg
      .num()
      .comp(async (content, _defaultCompletion) => {
        // offer 3 possible values
        const values = [20, 30, 40].map(String);
        if (!content) {
          return values;
        }
        return values.filter((v) => v.startsWith(content));
      })
  })
  .parse();
```

## Describe usage

When `QEL_DESCRIBE_USAGE` environment variable is set, program will output a *json* object instead of executing

<u>NB</u>: `DESCRIBE_USAGE` is also supported (for now) for backward compatibility

```js
/**
 * @typedef {Object} DescribeUsageItem
 * @property {string} name - argument name, starting with - or --
 * @property {(string|number|boolean)} [default] - only defined if argument has a default value
 * @property {string} valueText - text to display after argument names in usage (can be empty if argument does not accept a value)
 * @property {DescribeUsageItemType} type - argument type
 * @property {string[]} values - list of possible values (can be empty)
 * @property {string} format - name of the value format (ex: uuid or email) (empty if argument has no specific format)
 * @property {boolean} required - whether not argument is required (always false for flags)
 * @property {boolean} allowMany - whether or not argument can be set multiple times
 * @property {string} varName - name of the environment variable linked to this argument (can be empty)
 * @property {string[]} aliases - list of aliases for this argument (can be empty)
 * @property {string} description - argument description (can be empty)
 * @property {string} shortDescription - first line of the description (can be empty)
 * @property {boolean} allowNoFlags - whether or not --no-- flags are supported for this flag (always false for non flags arguments)
 */
```

<u>Example</u>

```js
const args = arg
  .parser({
    '--age': arg.num().pos().int().req().desc('user age'),
    '--name': arg
      .str('john')
      .enum(['john', 'jane'])
      .desc('user name')
      .val('NAME'),
    '--verbose': [arg.flag().no(false).desc('increase verbosity')],
    '-n': '--name',
    '-a': '--age',
    '-v': '--verbose',
  })
  .parse();
```

Running above program using `QEL_DESCRIBE_USAGE=1 program` will output the following

```json
[
  {
    "name": "--age",
    "type": "number",
    "required": true,
    "valueText": "NUM",
    "allowMany": false,
    "description": "user age",
    "shortDescription": "user age",
    "values": [],
    "format": "",
    "varName": "",
    "aliases": [
      "-a"
    ],
    "allowNoFlags": false
  },
  {
    "name": "--name",
    "type": "string",
    "required": false,
    "valueText": "NAME",
    "allowMany": false,
    "description": "user name",
    "shortDescription": "user name",
    "values": [
      "john",
      "jane"
    ],
    "format": "",
    "varName": "",
    "aliases": [
      "-n"
    ],
    "allowNoFlags": false,
    "default": "john"
  },
  {
    "name": "--verbose",
    "type": "flag",
    "required": false,
    "valueText": "",
    "allowMany": true,
    "description": "increase verbosity",
    "shortDescription": "increase verbosity",
    "values": [],
    "format": "",
    "varName": "",
    "aliases": [
      "-v"
    ],
    "allowNoFlags": false,
    "default": false
  },
  {
    "name": "--help",
    "type": "flag",
    "required": false,
    "valueText": "",
    "allowMany": false,
    "description": "print help",
    "shortDescription": "print help",
    "values": [],
    "format": "",
    "varName": "",
    "aliases": [
      "-h"
    ],
    "allowNoFlags": false,
    "default": false
  }
]
```

## Shell completion

Scripts can provide their own completion (for _bash_ and _zsh_)

Following environment variables need to be set to trigger shell completion

- **COMP_LINE** : full command line
- **COMP_POINT** : cursor position

Following environment variables can be used to customize the behaviour

- QEL_COMPLETION_SHELL : shell (default = `bash`)
- QEL_COMPLETION_INCLUDE_ARG_ALIASES : whether or not aliases should be offered (default = `true`)
- QEL_COMPLETION_DEBUG : filepath where completion logs should be written

It is possible to provide a [custom completion](#argvalidatorcomp) function for an `ArgValidator`

<u>NB</u>: when using `arg.js` without `ArgParser`, you should call the `checkCompletion` _async_ function

```js
const args = arg({
  '--name': String,
  '--mood': [String],
  '--age': Number,
  '-n': '--name',
  '-m': '--mood',
  '-a': '--age',
});
/*
  If completion is needed, we don't want the rest of the code to be executed
 */
await args.checkCompletion();

/*
  Following code won't be executed if completion is needed
 */
console.log(JSON.stringify(args));
```

### Completion functions

Some shell functions are provided (as an example) to setup the completion for various shells

<u>NB</u>: the same function can be shared for all scripts

#### bash

```shell
_qel_completion() {
  local IFS=$'\n'

  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword

  # command which triggered the completion
  local cmd=${words[0]}
  local extension="${cmd##*.}"

  # call command to get completions
  local output
  if [[ "${extension}" == 'js' ]]; then
    output=$(COMP_LINE="${COMP_LINE}" COMP_POINT="${COMP_POINT}" qjs.sh --unhandled-rejection ${cmd})
  else
    output=$(COMP_LINE="${COMP_LINE}" COMP_POINT="${COMP_POINT}" ${cmd})
  fi

  if [[ -n "${output}" ]]; then
    case "$output" in
    "@QEL_DIR@")
      # complete only directories
      _filedir -d
      ;;
    "@QEL_PATH@")
      # complete files and directories
      _filedir
      ;;
    *)
      # use completions from command
      COMPREPLY=($output)
      ;;
    esac
  fi
}
```

Scripts can then be registered like this


```shell
# Register the completion function for your command
complete -F _qel_completion my-script
```

#### zsh

```shell
_qel_completion() {
  # full command line up to cursor position
  local cmd_line="${BUFFER[1, $CURSOR]}"

  # command which triggered the completion
  local cmd="${words[1]}"
  local extension="${cmd##*.}"

  # call command to get completions
  local output
  if [[ "${extension}" == 'js' ]]; then
    output=$(QEL_COMPLETION_SHELL=zsh COMP_LINE="${cmd_line}" COMP_POINT="${CURSOR}" qjs.sh --unhandled-rejection ${cmd})
  else
    output=$(QEL_COMPLETION_SHELL=zsh COMP_LINE="${cmd_line}" COMP_POINT="${CURSOR}" ${cmd})
  fi

  if [[ -n "${output}" ]]; then
    case "$output" in
    "@QEL_DIR@")
      # complete only directories
      _files -/
      ;;
    "@QEL_PATH@")
      # complete files and directories
      _files
      ;;
    *)
      # use completions from command
      local completions=("${(f)${output}}")
      completions=("${(f)output}")
      _describe 'completions' completions
      ;;
    esac
  fi
}
```

Scripts can then be registered like this


```shell
# Register the completion function for your command
compdef _qel_completion my-script
```

## Faq

### Does it support sub commands ?

No :blush:. It's outside of the scope of the module, and is unlikely to happen anytime soon

### Does it support completion

Yes, see [shell completion](#shell-completion) :smile:

