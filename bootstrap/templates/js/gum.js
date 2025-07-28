#!/usr/bin/env -S qjs.sh -m
/** @format */
// @ts-check

import * as std from './ext/std.js';

import * as gum from './ext/gum.js';

/*
  Hello world using Gum
 */

const name = gum.input({
  prompt: 'What is your name ? ',
});
if (!name) {
  std.err.puts(
    gum.format(`Looks like you're not in the mood... Goodbye then :cry:.`, {
      type: gum.FormatType.EMOJI,
    })
  );
  std.exit(1);
} else {
  std.err.puts(
    `Hello ${gum.style(name, {
      foreground: '212',
      bold: true,
    })} !. Nice to meet you ${gum.format(':smile:.', {
      type: gum.FormatType.EMOJI,
    })}`
  );
}
