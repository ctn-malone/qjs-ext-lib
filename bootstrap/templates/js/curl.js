/** @format */
// @ts-check

import * as std from './ext/std.js';

import { curlRequest } from './ext/curl.js';

/*
  Output the 5 most popular repositories on github as json
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

std.err.puts(`The ${COUNT} most popular repositories on github\n`);
std.out.puts(`${JSON.stringify(repos, null, 2)}\n`);
