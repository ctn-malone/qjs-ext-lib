#!/usr/bin/env -S qjs.sh -m
/** @format */
// @ts-check

import * as std from './ext/std.js';

import { curlRequest } from './ext/curl.js';
import * as gum from './ext/gum.js';

/*
  Retrieve the 5 most popular repositories on github, let user choose one
  and output some of its information as a table
 */

const BASE_URL = 'https://api.github.com';
const COUNT = 5;

const output = await curlRequest(`${BASE_URL}/search/repositories`, {
  params: {
    q: 'stars:>1',
    sort: 'stars',
    order: 'desc',
    per_page: COUNT,
  },
});

/**
 * @typedef {Object} Repository
 * @property {string} full_name
 * @property {string} html_url
 * @property {number} stargazers_count
 */

/** @type {Repository[]} */
const repos = output.items.map((/** @type {Repository} */ obj) => ({
  full_name: obj.full_name,
  html_url: obj.html_url,
  stargazers_count: obj.stargazers_count,
}));

const repo = gum.chooseItemFromList(
  repos.map((repo) => ({ text: repo.full_name, value: repo })),
  {
    header: 'Please choose a repository',
  }
);
if (!repo) {
  std.exit(1);
} else {
  const table = gum.renderTable(
    ['Url', 'Stars'],
    [[repo.value.html_url, String(repo.value.stargazers_count)]],
    {
      border: gum.Border.NORMAL,
      custom: {
        env: {
          GUM_TABLE_BORDER_FOREGROUND: 212,
        },
      },
    }
  );
  std.out.puts(`${table}\n`);
}
