/** @format */
// @ts-check

import { tester } from '../../src/tester.js';
import * as path from '../../src/path.js';
import * as std from '../../src/std.js';
import * as os from '../../src/os.js';

export default () => {
  tester.test('path.getScriptName', () => {
    let name;
    name = path.getScriptName(false);
    tester.assert(
      name == 'run.js',
      `script name with extension should be 'run.js' (${name})`
    );
    name = path.getScriptName(true);
    tester.assert(
      name == 'run',
      `script name without extension should be 'run' (${name})`
    );
  });

  tester.test('path.getHomeDir', () => {
    const homeVar = std.getenv('HOME');

    std.setenv('HOME', '/home/john-doe');
    const homeDir = path.getHomeDir();
    tester.assertEq(
      homeDir,
      '/home/john-doe',
      "it should get value from 'HOME' env var"
    );
    std.unsetenv('HOME');

    if (homeVar !== undefined) {
      std.setenv('HOME', homeVar);
    }
  });

  tester.test('path.getTmpDir', () => {
    const tmpVar = std.getenv('TMPDIR');

    std.setenv('TMPDIR', '/tmp/abc');
    let tmpDir = path.getTmpDir();
    tester.assertEq(
      tmpDir,
      '/tmp/abc',
      "it should get value from 'TMPDIR' env var"
    );

    std.unsetenv('TMPDIR');
    tmpDir = path.getTmpDir();
    tester.assertEq(tmpDir, '/tmp', "it should fallback to '/tmp'");

    if (tmpVar !== undefined) {
      std.setenv('TMPDIR', tmpVar);
    }
  });

  tester.test('path.basename', () => {
    const data = [
      { input: ['/foo/bar/baz/asdf/quux.html'], expected: 'quux.html' },
      { input: ['/foo/bar/baz/asdf/quux.html', '.html'], expected: 'quux' },
      { input: ['/foo/bar/baz/asdf/'], expected: 'asdf' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.basename(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.dirname', () => {
    const data = [
      { input: ['/foo/bar/baz/asdf/quux'], expected: '/foo/bar/baz/asdf' },
      { input: ['/foo/bar'], expected: '/foo' },
      { input: ['/'], expected: '/' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.dirname(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.extname', () => {
    const data = [
      { input: ['/foo/bar/baz/asdf/quux.html'], expected: '.html' },
      { input: ['/foo/bar/baz/asdf/quux'], expected: '' },
      { input: ['/foo/bar/baz/asdf/quux.html.md'], expected: '.md' },
      { input: ['.hiddenfile'], expected: '' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.extname(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.format', () => {
    const data = [
      {
        input: {
          root: '/ignored',
          dir: '/home/user/dir',
          base: 'file.txt',
        },
        expected: '/home/user/dir/file.txt',
      },
      {
        input: {
          root: '/',
          base: 'file.txt',
          ext: 'ignored',
        },
        expected: '/file.txt',
      },
      {
        input: {
          root: '/',
          name: 'file',
          ext: '.txt',
        },
        expected: '/file.txt',
      },
      {
        input: {
          root: '/',
          name: 'file',
          ext: 'txt',
        },
        expected: '/file.txt',
      },
    ];

    for (const { input, expected } of data) {
      const value = path.format(input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.parse', () => {
    const data = [
      {
        input: '/home/user/dir/file.txt',
        expected: {
          root: '/',
          dir: '/home/user/dir',
          base: 'file.txt',
          ext: '.txt',
          name: 'file',
        },
      },
    ];

    for (const { input, expected } of data) {
      const value = path.parse(input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.isAbsolute', () => {
    const data = [
      { input: ['/foo/bar'], expected: true },
      { input: ['foo/bar'], expected: false },
      { input: [''], expected: false },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.isAbsolute(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.join', () => {
    const data = [
      { input: ['foo', 'bar', 'baz'], expected: 'foo/bar/baz' },
      { input: ['/foo', 'bar', 'baz'], expected: '/foo/bar/baz' },
      { input: ['/foo', '', 'bar', 'baz'], expected: '/foo/bar/baz' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.join(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.normalize', () => {
    const data = [
      { input: ['/foo/bar//baz/asdf/quux/..'], expected: '/foo/bar/baz/asdf' },
      {
        input: ['/foo/bar//././baz/asdf/quux/..'],
        expected: '/foo/bar/baz/asdf',
      },
      { input: ['/foo/bar//baz/asdf/quux/../..'], expected: '/foo/bar/baz' },
      { input: ['/../../'], expected: '/' },
      { input: ['../../foo/bar'], expected: '../../foo/bar' },
      { input: ['../../foo/../../'], expected: '../../../' },
      { input: ['../../foo/../..'], expected: '../../..' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.normalize(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.resolve', () => {
    const [pwd, _] = os.getcwd();
    const data = [
      { input: ['/foo/bar', './baz'], expected: '/foo/bar/baz' },
      { input: ['/foo/bar', '/tmp/file/'], expected: '/tmp/file' },
      {
        input: ['wwwroot', 'static_files/png/', '../gif/image.gif'],
        expected: `${pwd}/wwwroot/static_files/gif/image.gif`,
      },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.resolve(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }
  });

  tester.test('path.relative', () => {
    const [pwd, _] = os.getcwd();
    const data = [
      {
        input: ['/data/orandea/test/aaa', '/data/orandea/impl/bbb'],
        expected: '../../impl/bbb',
      },
      {
        input: ['/data/orandea/.//test/aaa', '/data/orandea/impl/bbb'],
        expected: '../../impl/bbb',
      },
      { input: ['/foo/bar/baz', '/foo/bar/baz/quux'], expected: 'quux' },
      { input: ['/foo/bar/baz', '/foo/bar'], expected: '..' },
      { input: ['/foo/bar/baz', '/foo/bar/baz'], expected: '' },
    ];

    for (const { input, expected } of data) {
      // @ts-ignore
      const value = path.relative(...input);
      tester.assertEq(
        value,
        expected,
        `value should be ${JSON.stringify(
          expected
        )} when input is ${JSON.stringify(input)}`
      );
    }

    let value = path.relative('', '/foo');
    let expected = path.relative(pwd, '/foo');
    tester.assertEq(
      value,
      expected,
      `current directory should be used as 'from' argument when input is ${JSON.stringify(
        ['', '/foo']
      )}`
    );

    value = path.relative('/foo', '');
    expected = path.relative('/foo', '');
    tester.assertEq(
      value,
      expected,
      `current directory should be used as 'to' argument when input is ${JSON.stringify(
        ['/foo', '']
      )}`
    );
  });

  tester.test('path.toNamespacedPath', () => {
    const value = path.toNamespacedPath('/foo/bar');
    tester.assertEq(value, '/foo/bar', 'it should return the same path');
  });
};
