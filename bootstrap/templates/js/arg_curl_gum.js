/** @format */
// @ts-check

// @ts-ignore
import * as std from 'std';

import arg from './ext/arg.js';
import { curlRequest } from './ext/curl.js';
import * as gum from './ext/gum.js';

/*
  Retrieve the N most popular repositories on github, let user choose one
  and output some of its information as json or as a table
 */

const BASE_URL = 'https://api.github.com';

const args = arg
  .parser({
    '--format': arg.str().req().enum(['json', 'table']).desc('output format'),
    '--count': arg.num(5).min(1).max(10).desc('number of repositories (1..10)'),
    '--verbose': arg.flag().desc('if set, output extra information to stderr'),
    // aliases
    '-f': '--format',
    '-c': '--count',
    '-v': '--verbose',
  })
  .desc(
    'Retrieve the N most popular repositories on github, let user choose one and output some of its informations'
  )
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

const repo = gum.chooseItemFromList(
  repos.map((repo) => ({ text: repo.full_name, value: repo })),
  {
    header: 'Please choose a repository',
  }
);
if (!repo) {
  std.exit(1);
} else {
  if (args['--format'] === 'json') {
    std.out.puts(`${JSON.stringify(repo.value, null, 2)}\n`);
    std.exit(0);
  }
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
