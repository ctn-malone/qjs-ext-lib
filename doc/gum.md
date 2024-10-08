# gum

A wrapper around *gum* binary

## getVersion(...)

`getVersion()`

Retrieve gum version

**returns** *string|undefined* (ex: `0.12.0`)

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const version = gum.getVersion();
console.log(version);
```

## hasGum(...)

`hasGum()`

Indicates whether or not gum binary exists

**returns** *boolean*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

console.log(gum.hasGum());
```

## getDefaultEnv(...)

`getDefaultEnv()`

Retrieve default gum environment variables

**returns** *Record<string,string>*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const env = gum.getDefaultEnv();
console.log(JSON.stringify(env, null, 2));
```

## chooseItemFromList(...)

`chooseItemFromList(list, opt)`

Choose a single item from a list

```
> gum choose --limit 1 ...
```

* **list** (*ListItem<T>[]|string[]*) : list to choose from
* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.selected (*ListItem<T>|string*) : default item
  * opt.cursor (*string*) : prefix to show on item that corresponds to the cursor position (default = `"> "`) ($GUM_CHOOSE_CURSOR)
  * opt.height (*number*) : height of the list (default = `10`) ($GUM_CHOOSE_HEIGHT)
  * opt.custom (*CustomOptions*)

**returns** *ListItem<T>|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const item = gum.chooseItemFromList(
  [
    { text: 'Red', value: { name: 'blue', code: '#ff0000' } },
    { text: 'Green', value: { name: 'green', code: '#00ff00' } },
    { text: 'Blue', value: { name: 'blue', code: '#0000ff' } },
  ],
  {
    cursor: '>> '
  }
);
console.log(JSON.stringify(item, null, 2));
```

## chooseItemsFromList(...)

`chooseItemsFromList(list, opt)`

Choose multiple items from a list (press `Space` to select / unselect an item, `Enter` to confirm)

```
> gum choose --no-limit ...
```

* **list** (*ListItem<T>[]|string[]*) : list to choose from
* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.selected (*ListItem<T>|ListItem<T>[]|string|string[]*) : selected items
  * opt.cursor (*string*) : prefix to show on item that corresponds to the cursor position (default = `"> "`) ($GUM_CHOOSE_CURSOR)
  * opt.height (*number*) : height of the list (default = `10`) ($GUM_CHOOSE_HEIGHT)
  * opt.limit (*number*) : maximum number of items to select (no limit by default)
  * opt.ordered (*boolean*) : maintain the order of the selected items (default = `false`) ($GUM_CHOOSE_ORDERED)
  * opt.cursorPrefix (*string*) : prefix to show on the cursor item (default = `"○ "`) ($GUM_CHOOSE_CURSOR_PREFIX)
  * opt.selectedPrefix (*string*) : prefix to show on selected items (default = `"◉ "`) ($GUM_CHOOSE_SELECTED_PREFIX)
  * opt.unselectedPrefix (*string*) : prefix to show on unselected items (default = `"○ "`) ($GUM_CHOOSE_UNSELECTED_PREFIX)
  * opt.custom (*CustomOptions*)

**returns** *ListItem<T>[]|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const item = gum.chooseItemsFromList(
  [
    { text: 'Red', value: { name: 'blue', code: '#ff0000' } },
    { text: 'Green', value: { name: 'green', code: '#00ff00' } },
    { text: 'Blue', value: { name: 'blue', code: '#0000ff' } },
  ],
  { 
    cursor: '>> ',
    limit: 2, 
    selectedPrefix: 'X '
  }
);
console.log(JSON.stringify(item, null, 2));
```

## filterItemFromList(...)

`filterItemFromList(list, opt)`

Choose a single item by filtering a list

```
> gum filter --limit 1 ...
```

* **list** (*ListItem<T>[]|string[]*) : list to choose from
* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.placeholder (*string*) : placeholder value (default = `"Filter..."`) ($GUM_FILTER_PLACEHOLDER)
  * opt.width (*number*) : width of the list (default = `20`) ($GUM_FILTER_WIDTH)
  * opt.height (*number*) : height of the list (no limit by default, will depend on the terminal) ($GUM_FILTER_HEIGHT)
  * opt.prompt (*string*) : prompt to display (default = `"> "`) ($GUM_FILTER_PROMPT)
  * opt.value (*string*) : initial filter value
  * opt.fuzzy (*boolean*) : enable fuzzy search (default = `true`) ($GUM_FILTER_FUZZY)
  * opt.reverse (*boolean*) : display from the bottom of the screen (default = `false`) ($GUM_FILTER_REVERSE)
  * opt.sort (*boolean*) : sort the results (default = `true`) ($GUM_FILTER_SORT)
  * opt.custom (*CustomOptions*)

**returns** *ListItem<T>|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const item = gum.filterItemFromList(
  ['Red', 'Green', 'Blue'],
  { 
    prompt: '>> ',
  }
);
console.log(JSON.stringify(item, null, 2));
```

## filterItemsFromList(...)

`filterItemsFromList(list, opt)`

Choose multiple items by filtering a list (press `Ctrl+Space` to select/unselect an item, `Enter` to confirm)

```
> gum filter --no-limit ...
```

* **list** (*ListItem<T>[]|string[]*) : list to choose from
* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.placeholder (*string*) : placeholder value (default = `"Filter..."`) ($GUM_FILTER_PLACEHOLDER)
  * opt.width (*number*) : width of the list (default = `20`) ($GUM_FILTER_WIDTH)
  * opt.height (*number*) : height of the list (no limit by default, will depend on the terminal) ($GUM_FILTER_HEIGHT)
  * opt.prompt (*string*) : prompt to display (default = `"> "`) ($GUM_FILTER_PROMPT)
  * opt.value (*string*) : initial filter value
  * opt.limit (*number*) : maximum number of items to select (no limit by default)
  * opt.fuzzy (*boolean*) : enable fuzzy search (default = `true`) ($GUM_FILTER_FUZZY)
  * opt.reverse (*boolean*) : display from the bottom of the screen (default = `false`) ($GUM_FILTER_REVERSE)
  * opt.sort (*boolean*) : sort the filtered items (default = `true`) ($GUM_FILTER_SORT)
  * opt.indicator (*string*) : character for selection (default = `"•"`) ($GUM_FILTER_INDICATOR)
  * opt.selectedPrefix (*string*) : character to indicate selected items (default = `" ◉ "`) ($GUM_FILTER_SELECTED_PREFIX)
  * opt.unselectedPrefix (*string*) : character to indicate selected items (default = `" ○ "`) ($GUM_FILTER_UNSELECTED_PREFIX)
  * opt.custom (*CustomOptions*)

**returns** *ListItem<T>[]|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const item = gum.filterItemsFromList(
  ['Red', 'Green', 'Blue'],
  { 
    prompt: '>> ',
    limit: 2,
    placeholder: 'Type anything...'
  }
);
console.log(JSON.stringify(item, null, 2));
```

## style(...)

`style(text, opt)`

Apply coloring, borders, spacing to text

```
> gum style ...
```

* **text** (*string|string[]*) : text to style
* opt (*object*) : options
  * opt.background (*string|number*) : background color ($BACKGROUND)
  * opt.foreground (*string|number*) : foreground color ($FOREGROUND)
  * opt.border (*Border*) : border style (default = `Border.NONE`) ($BORDER)
  * opt.borderBackground (*string|number*) : border background color ($BORDER_BACKGROUND)
  * opt.borderForeground (*string|number*) : border foreground color ($BORDER_FOREGROUND)
  * opt.align (*Align*) : text alignment (default = `Align.LEFT`) ($ALIGN)
  * opt.height (*number*) : text height (default = `1`) ($HEIGHT)
  * opt.width (*number*) : text width (default = `0, automatic width`) ($WIDTH)
  * opt.marginLeft - top margin (default = `0`) ($MARGIN_LEFT)
  * opt.marginRight - right margin (default = `0`) ($MARGIN_RIGHT)
  * opt.marginTop - top margin (default = `0`) ($MARGIN_TOP)
  * opt.marginBottom - bottom margin (default = `0`) ($MARGIN_BOTTOM)
  * opt.paddingLeft - left padding (default = `0`) ($PADDING_LEFT)
  * opt.paddingRight - right padding (default = `0`) ($PADDING_RIGHT)
  * opt.paddingTop - top padding (default = `0`) ($PADDING_TOP)
  * opt.paddingBottom - bottom padding (default = `0`) ($PADDING_BOTTOM)
  * opt.bold (*boolean*) : bold text (default = `false`) ($BOLD)
  * opt.italic (*boolean*) : italicize text (default = `false`) ($ITALIC)
  * opt.strikethrough (*boolean*) : strikethrough text (default = `false`) ($STRIKETHROUGH)
  * opt.underline (*boolean*) : underline text (default = `false`) ($UNDERLINE)
  * opt.faint (*boolean*) : faint text (default = `false`) ($FAINT)
  * opt.custom (*CustomOptions*)

**returns** *string*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const text = `${gum.style('Hello', {
  bold: true,
  foreground: '#ff0000',
})}, what do you want to do ${gum.style('today', {
  foreground: '#0000ff',
})} ?`;
const textWithBorder = gum.style(text, {
  border: gum.Border.ROUNDED,
  paddingHorizontal: 3,
  paddingVertical: 1,
});
console.log(textWithBorder);
```

## renderTable(...)

`renderTable(columns, rows, opt)`

Render a list of rows as a table

```
> gum table --print --separator ',' ...
```

* **columns** (*string[]*) : column names
* **rows** (*TableRow<T>[]|string[][]*)
* opt (*object*) : options
  * opt.border (*Border*) : border style (default = `Border.ROUNDED`)
  * opt.widths (*number[]*) : column widths
  * opt.custom (*CustomOptions*)

**returns** *string*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const table = gum.renderTable(
  ['Name', 'Age', 'City'],
  [
    ['John', '30', 'New York'],
    ['Jane', '25', 'London'],
    ['Bob', '40', 'Paris'],
  ],
  {
    border: gum.Border.DOUBLE,
  }
);
console.log(table);
```

## chooseRowFromTable(...)

`chooseRowFromTable(columns, rows, opt)`

Choose a row from a table

```
> gum table --separator ',' ...
```

* **columns** (*string[]*) : column names
* **rows** (*TableRow<T>[]|string[][]*)
* opt (*object*) : options
  * opt.widths (*number[]*) : column widths
  * opt.height (*number*) : table height (default = `20`)
  * opt.custom (*CustomOptions*)

**returns** *TableRow<T>|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const item = gum.chooseRowFromTable(
  ['Name', 'Age', 'City'],
  [
    { fields: ['John', '30', 'New York'], value: 'john' },
    { fields: ['Jane', '25', 'London'], value: 'jane' },
    { fields: ['Bob', '40', 'Paris'], value: 'bob' },
  ]
);
console.log(JSON.stringify(item, null, 2));
```

## confirm(...)

`confirm(opt)`

Ask user to confirm an action

```
> gum confirm ...
```

* opt (*object*) : options
  * opt.prompt (*string*) : prompt to display (default = `"Are you sure?""`)
  * opt.affirmative (*string*) : affirmative answer (default = `"Yes"`)
  * opt.negative (*string*) : negative answer (default = `"No"`)
  * opt.default (*ConfirmAnswer*) : default confirmation action (default = `ConfirmAnswer.YES`)
  * opt.custom (*CustomOptions*)

**returns** *boolean|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const command = gum.style('rm -rf /', { bold: true });
const doIt = gum.confirm({
  prompt: `Do you really want to run ${command}`,
  affirmative: 'Sure, do it :)',
  negative: 'Hell, no !',
  default: gum.ConfirmAnswer.NO,
});
console.log(doIt);
```

## chooseFile(...)

`chooseFile(opt)`

Pick a file from a folder

```
> gum file --file=true --directory=false ...
```

* opt (*object*) : options
  * opt.path (*string*) : the path to the folder to begin traversing (default = current directory)
  * opt.all (*boolean*) : if true, show hidden and 'dot' files
  * opt.cursor (*string*) : the cursor character (default = `">"`) ($GUM_FILE_CURSOR)
  * opt.height (*number*) : maximum number of entries to display (default = `50`) ($GUM_FILE_HEIGHT)
  * opt.custom (*CustomOptions*)

**returns** *string|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const filename = gum.chooseFile({
  path: '/tmp',
  cursor: '>>',
  height: 10,
});
console.log(filename);
```

## chooseDirectory(...)

`chooseDirectory(opt)`

Pick a directory from a folder

```
> gum file --file=true --directory=false ...
```

* opt (*object*) : options
  * opt.path (*string*) : the path to the folder to begin traversing (default = current directory)
  * opt.all (*boolean*) : if true, show hidden and 'dot' files
  * opt.cursor (*string*) : the cursor character (default = `">"`) ($GUM_FILE_CURSOR)
  * opt.height (*number*) : maximum number of entries to display (default = `50`) ($GUM_FILE_HEIGHT)
  * opt.custom (*CustomOptions*)

**returns** *string|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const filename = gum.chooseDirectory({
  path: '/tmp',
  cursor: '>>',
  height: 10,
});
console.log(filename);
```

## spin(...)

`spin(promise, opt)`

Display a spinner while a promise is resolving

```
> gum spin ...
```

* promise (*Promise*) : promise to wait for
* opt (*object*) : options
  * opt.title (*string*) : title value (default = `"Loading..."`) ($GUM_SPIN_TITLE)
  * opt.spinner (*string*) : spinner value (default = `Spinner.DOT`) ($GUM_SPIN_SPINNER)
  * opt.align (*string*) : alignment of spinner with regard to the title (default = `Align.LEFT`) ($GUM_SPIN_ALIGN)
  * opt.custom (*CustomOptions*)

**returns** *Promise<boolean>* whether or not spinner was cancelled (ie: using Ctrl+C)

<u>Example</u>

```js
import * as gum from 'ext/gum.js';
import { wait } from 'ext/timers.js';

const main = async () => {
  await gum.spin(wait(1000), {
    spinner: gum.Spinner.PULSE,
    title: 'Please, be patient...',
  });
};
main();
```

## input(...)

`input(opt)`

Prompt for some input

```
> gum input ...
```

* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.cursorMode (*string*) : cursor mode (default = `CursorMode.BLINK`) ($GUM_INPUT_CURSOR_MODE)
  * opt.placeholder (*string*) : placeholder value (default = `"Type something..."`) ($GUM_INPUT_PLACEHOLDER)
  * opt.value (*string*) : initial value
  * opt.prompt (*string*) : prompt to display (default = `"> "`) ($GUM_INPUT_PROMPT)
  * opt.password (*boolean*) : mask input characters (default = `false`)
  * opt.charLimit (*number*) : maximum value length (default = `400, 0 for no limit`)
  * opt.width (*number*) : input width (default = `40, 0 for terminal width`) ($GUM_INPUT_WIDTH)
  * opt.custom (*CustomOptions*)

**returns** *string|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const name = gum.input({
  header: 'What is your name ?',
  placeholder: 'Enter your name here',
  cursorMode: gum.CursorMode.BLINK,
  prompt: '>> ',
  custom: {
    env: {
      GUM_INPUT_HEADER_FOREGROUND: '#ffff00',
    },
  },
});
if (name) {
  console.log(`Hello, ${name} !`);
}
```

## write(...)

`write(opt)`

Prompt for long-form text (press `Ctrl+D` or `Esc` to confirm)

```
> gum write ...
```

* opt (*object*) : options
  * opt.header (*string*) : header value
  * opt.cursorMode (*string*) : cursor mode (default = `CursorMode.BLINK`) ($GUM_WRITE_CURSOR_MODE)
  * opt.placeholder (*string*) : placeholder value (default = `"Write something..."`) ($GUM_WRITE_PLACEHOLDER)
  * opt.value (*string*) : initial value
  * opt.prompt (*string*) : prompt to display (default = `"┃ "`) ($GUM_WRITE_PROMPT)
  * opt.charLimit (*number*) : maximum value length (default = `400, 0 for no limit`)
  * opt.width (*number*) : input width (default = `50, 0 for no limit`) ($GUM_WRITE_WIDTH)
  * opt.height (*number*) : input height (default = `10`) ($GUM_WRITE_HEIGHT)
  * opt.showLineNumbers (*boolean*) : show line numbers (default = `false`) ($GUM_WRITE_SHOW_LINE_NUMBERS)
  * opt.custom (*CustomOptions*)

**returns** *string|undefined*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const content = gum.write({
  header: 'How was your day ?',
  placeholder: 'Write something and press ESC to confirm...',
  showLineNumbers: true,
});
if (content) {
  console.log(content);
}
```

## format(...)

`format(text, opt)`

Format a string using a template

```
> gum format ...
```

* **text** (*string*) : text to format
* opt (*object*) : options
  * opt.type (*FormatType*) : format type (default = `FormatType.MARKDOWN`) ($GUM_FORMAT_TYPE)
  * opt.language (*string*) : programming language to parse when using FormatType.Code ($GUM_FORMAT_LANGUAGE)
  * opt.theme (*FormatTheme*) : theme to use for markdown formatting (default = `FormatTheme.PINK`) ($GUM_FORMAT_THEME)
  * opt.custom (*CustomOptions*)

**returns** *string*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const code = `
const type = 'code';
console.log(type);
`.trim();

const markdown = `
# Format commande

## Purpose

It allows you to format text which can be

- ${gum.FormatType.MARKDOWN}
- ${gum.FormatType.CODE} ${gum.format(code, {
  type: gum.FormatType.CODE,
  language: 'js',
})}
- ${gum.FormatType.EMOJI} ${gum.format(':smile:', {
  type: gum.FormatType.EMOJI,
})}
`.trim();

console.log(gum.format(markdown, { type: gum.FormatType.MARKDOWN }));
```

## join(...)

`join(text, opt)`

Join text vertically or horizontally

```
> gum join ...
```

* **text** (*string[]*) : text to join
* opt (*object*) : options
  * opt.align (*Align*) : text alignment (default = `Align.LEFT`)
  * opt.direction (*JoinDirection*) : join direction (default = `JoinDirection.HORIZONTAL`)
  * opt.custom (*CustomOptions*)

**returns** *string*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const left = gum.style('This is left block', {
  border: gum.Border.DOUBLE,
  borderForeground: '212',
  paddingLeft: 1,
  paddingRight: 1,
  paddingTop: 1,
  paddingBottom: 1,
});

const right = gum.style('This is right block', {
  border: gum.Border.DOUBLE,
  borderForeground: '212',
  paddingLeft: 1,
  paddingRight: 1,
  paddingTop: 1,
  paddingBottom: 1,
  marginLeft: 1,
});

console.log(gum.join([left, right]));
```

## pager(...)

`pager(content, opt)`

Scroll through content

```
> gum pager ...
```

* **content** (*string*) : content to scroll
* opt (*object*) : options
  * opt.showLineNumbers (*boolean*) : show line numbers (default = `true`)
  * opt.softWrap (*boolean*) : soft wrap lines (default = `false`)
  * opt.custom (*CustomOptions*)

**returns** *string*

<u>Example</u>

```js
import * as gum from 'ext/gum.js';

const lines = [];
for (const i = 1; i < 100; ++i) {
  lines.push(i);
}
gum.pager(lines.join('\n'));
```

## clear(...)

`clear()`

Clear the terminal

<u>Example</u>

```js
import * as gum from 'ext/gum.js';
import { wait } from 'ext/timers.js';

const main = async () => {
  console.log(
    `${gum.style('Hello', {
      bold: true,
    })}, there !`
  );
  await wait(1000);
  gum.clear();
  console.log(
    gum.style('Goodbye !', {
      bold: true,
    })
  );
};
main();
```