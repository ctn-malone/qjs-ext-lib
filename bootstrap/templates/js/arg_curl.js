/** @format */
// @ts-check

import * as std from './ext/std.js';

import arg from './ext/arg.js';
import { curlRequest } from './ext/curl.js';

/*
  Output the N most popular repositories on github as json or text
 */

const BASE_URL = 'https://api.github.com';

const args = arg
  .parser({
    '--format': arg.str().req().enum(['json', 'text']).desc('output format'),
    '--count': arg.num(5).min(1).max(10).desc('number of repositories (1..10)'),
    '--verbose': arg.flag().desc('if set, output extra information to stderr'),
    // aliases
    '-f': '--format',
    '-c': '--count',
    '-v': '--verbose',
  })
  .desc('Output the N most popular repositories on github as json or text')
  .ex(['-f json', '-f text -c 10'])
  .parse();

if (args['--verbose']) {
  std.err.puts(
    `Retrieving the ${args['--count']} most popular repositories on github...\n`
  );
}

const output = await curlRequest(`${BASE_URL}/search/repositories`, {
  params: {
    q: 'stars:>1',
    sort: 'stars',
    order: 'desc',
    per_page: args['--count'],
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

if (args['--format'] === 'json') {
  std.out.puts(`${JSON.stringify(repos, null, 2)}\n`);
} else {
  std.err.puts(
    `The ${args['--count']} most popular repositories on github:\n\n`
  );
  const content = repos
    .map((repo) => `- ${repo.html_url} (${repo.stargazers_count} stars)`)
    .join('\n');
  std.out.puts(`${content}\n`);
}
