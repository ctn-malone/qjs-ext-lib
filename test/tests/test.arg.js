/** @format */
// @ts-check

// @ts-ignore
import * as std from 'std';
// @ts-ignore
import * as os from 'os';

import { tester } from '../../src/tester.js';
import { execSync } from '../../src/process.js';
import arg from '../../src/arg.js';

const createTmpDir = () => {
  const tmpDir = execSync('mktemp -d');
  return tmpDir;
};

const removeDir = (dir) => {
  execSync(`rm -rf ${dir}`);
};

export default () => {
  tester.test('arg - string validator (default)', () => {
    let validator = arg.str('defaultValue');
    let value = validator.validate(undefined, '--argname');
    tester.assertEq(
      value,
      'defaultValue',
      'value should match default value (1)'
    );

    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str('defaultValue').def(1);
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if default value is not a string'
    );

    validator = arg.str('defaultValue1').def('defaultValue2');
    value = validator.validate(undefined, '--argname');
    tester.assertEq(
      value,
      'defaultValue2',
      'value should match default value (2)'
    );
  });

  tester.test('arg - string validator (regexp)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().reg('1234');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if argument is not a Regexp'
    );

    const validator = arg.str().reg(/123456/);

    exceptionThrown = false;
    try {
      validator.validate('1234', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value does not match regexp'
    );

    const value = validator.validate('123456', '--argname');
    tester.assertEq(
      value,
      '123456',
      'it should be ok if value matches the regexp'
    );
  });

  tester.test('arg - string validator (length)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().min('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'min' argument is not a number"
    );

    let validator = arg.str().min(5);
    try {
      validator.validate('abc', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if length(value) < min length'
    );

    let value = validator.validate('abcde', '--argname');
    tester.assertEq(
      value,
      'abcde',
      'it should be ok if length(value) >= min length'
    );

    exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().max('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'max' argument is not a number"
    );

    validator = arg.str().max(5);
    try {
      validator.validate('abcdef', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if length(value) > max length'
    );

    value = validator.validate('abcde', '--argname');
    tester.assertEq(
      value,
      'abcde',
      'it should be ok if length(value) <= max length'
    );
  });

  tester.test('arg - string validator (enum)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().reg('1234');
      // @ts-ignore
      arg.str().reg([1, 2, 3]);
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if argument is not a string[]'
    );

    const validator = arg.str().enum(['abc', 'def']);

    exceptionThrown = false;
    try {
      validator.validate('1234', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is does not match enum values'
    );

    const value = validator.validate('abc', '--argname');
    tester.assertEq(
      value,
      'abc',
      'it should be ok if value matches enum values'
    );
  });

  tester.test('arg - string validator (fmt)', () => {
    let exceptionThrown = false;
    try {
      arg.str().fmt('unknown');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if format is unknown'
    );

    let validator = arg.str().fmt('email');
    let value = validator.validate('john.doe@gmail.com', '--argname');
    tester.assertEq(
      value,
      'john.doe@gmail.com',
      'it should be ok if value matches a known format'
    );

    arg.registerFormat('test', /test123/);
    validator = arg.str().fmt('test');
    value = validator.validate('test1234', '--argname');
    tester.assertEq(
      value,
      'test1234',
      'it should be ok if value matches a known custom format'
    );
  });

  tester.test('arg - string validator (trim)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().trim('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'trimContent' argument is not a boolean"
    );

    let validator = arg.str().trim();
    let value = validator.validate(' value ', '--argname');
    tester.assertEq(value, 'value', 'it should trim value');

    validator = arg.str().trim(false);
    value = validator.validate(' value ', '--argname');
    tester.assertEq(value, ' value ', 'it should not trim value');
  });

  tester.test('arg - path validator (default)', () => {
    const validator = arg.path('defaultValue');
    const value = validator.validate(undefined, '--argname');
    tester.assertEq(value, 'defaultValue', 'value should match default value');
  });

  tester.test('arg - path validator (std)', () => {
    let exceptionThrown = false;
    let validator = arg.path();
    try {
      validator.validate('-', '--argname');
    } catch (e) {
      exceptionThrown = true;
      tester.assert(
        exceptionThrown,
        "it should throw an exception if '-' was passed as argument value but 'std' was not called"
      );
    }

    let tmpDir = createTmpDir();
    validator = arg.path().std().dir().check();
    try {
      validator.validate('-', '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if '-' was passed as value argument but path is supposed to be a directory"
    );

    let called = false;
    validator = arg
      .path()
      .std()
      .check()
      .checkParent()
      .cust(() => {
        called = true;
      });
    const value = validator.validate('-', '--argname');
    tester.assertEq(
      value,
      '-',
      "it should ignore subsequent validators if value is '-' and 'std' was called"
    );
    tester.assert(
      !called,
      "it should ignore subsequent validators if value is '-' and 'std' was called"
    );
  });

  tester.test('arg - path validator (check/file)', () => {
    let tmpDir = createTmpDir();
    let exceptionThrown = false;
    let validator = arg.path().check();
    try {
      validator.validate(`${tmpDir}/nonexistent`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if file does not exist'
    );

    tmpDir = createTmpDir();
    validator = arg.path().check(false);
    try {
      const value = validator.validate(`${tmpDir}/nonexistent`, '--argname');
      tester.assertEq(
        value,
        `${tmpDir}/nonexistent`,
        'it should be ok if file does not exist but is not supposed to exist'
      );
    } finally {
      removeDir(tmpDir);
    }

    tmpDir = createTmpDir();
    std.open(`${tmpDir}/file`, 'w+');
    validator = arg.path().check();
    try {
      const value = validator.validate(`${tmpDir}/file`, '--argname');
      tester.assertEq(
        value,
        `${tmpDir}/file`,
        'it should be ok if file exists'
      );
    } finally {
      removeDir(tmpDir);
    }
  });

  tester.test('arg - path validator (check/dir)', () => {
    let tmpDir = createTmpDir();
    let exceptionThrown = false;
    let validator = arg.path().dir().check();
    try {
      validator.validate(`${tmpDir}/nonexistent`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if directory does not exist'
    );

    tmpDir = createTmpDir();
    validator = arg.path().dir().check(false);
    try {
      const value = validator.validate(`${tmpDir}/nonexistent`, '--argname');
      tester.assertEq(
        value,
        `${tmpDir}/nonexistent`,
        'it should be ok if directory does not exist but is not supposed to exist'
      );
    } finally {
      removeDir(tmpDir);
    }

    tmpDir = createTmpDir();
    // @ts-ignore
    os.mkdir(`${tmpDir}/subdir`);
    exceptionThrown = false;
    validator = arg.path().dir().check();
    try {
      const value = validator.validate(`${tmpDir}/subdir`, '--argname');
      tester.assertEq(
        value,
        `${tmpDir}/subdir`,
        'it should be ok if directory exists'
      );
    } finally {
      removeDir(tmpDir);
    }

    exceptionThrown = false;
    tmpDir = createTmpDir();
    std.open(`${tmpDir}/file`, 'w+');
    exceptionThrown = false;
    validator = arg.path().dir().check();
    try {
      validator.validate(`${tmpDir}/file`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if entry exists but is not a directory'
    );
  });

  tester.test('arg - path validator (checkParent)', () => {
    let tmpDir = createTmpDir();
    let exceptionThrown = false;
    let validator = arg.path().dir().checkParent();
    try {
      validator.validate(`${tmpDir}/nonexistent/file`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if parent directory does not exist'
    );

    tmpDir = createTmpDir();
    validator = arg.path().dir().checkParent();
    try {
      const value = validator.validate(`${tmpDir}/file`, '--argname');
      tester.assertEq(
        value,
        `${tmpDir}/file`,
        'it should be ok if parent directory exists'
      );
    } finally {
      removeDir(tmpDir);
    }
  });

  tester.test('arg - path validator (ensure/file)', () => {
    let tmpDir = createTmpDir();
    let validator = arg.path().ensure();
    try {
      validator.validate(`${tmpDir}/nonexistent`, '--argname');
      // @ts-ignore
      const [obj, err] = os.stat(`${tmpDir}/nonexistent`);
      tester.assertEq(err, 0, 'it should create the file if it does not exist');
    } finally {
      removeDir(tmpDir);
    }
  });

  tester.test('arg - path validator (ensure/dir)', () => {
    let tmpDir = createTmpDir();
    let validator = arg.path().dir().ensure();
    try {
      validator.validate(`${tmpDir}/a/b/c`, '--argname');
      // @ts-ignore
      const [obj, err] = os.stat(`${tmpDir}/a/b/c`);
      tester.assertEq(
        err,
        0,
        'it should create the directory if it does not exist'
      );
      tester.assertEq(
        // @ts-ignore
        obj.mode & os.S_IFDIR,
        // @ts-ignore
        os.S_IFDIR,
        'it should create the directory if it does not exist'
      );
    } finally {
      removeDir(tmpDir);
    }
  });

  tester.test('arg - path validator (ensureParent)', () => {
    let tmpDir = createTmpDir();
    let validator = arg.path().ensureParent();
    try {
      validator.validate(`${tmpDir}/a/b/c/nonexistent`, '--argname');
      // @ts-ignore
      const [obj, err] = os.stat(`${tmpDir}/a/b/c`);
      tester.assertEq(
        // @ts-ignore
        obj.mode & os.S_IFDIR,
        // @ts-ignore
        os.S_IFDIR,
        'it should create the parent directory if it does not exist'
      );
    } finally {
      removeDir(tmpDir);
    }
  });

  tester.test('arg - path validator (read)', () => {
    let tmpDir = createTmpDir();
    let validator = arg.path().read();
    let file = std.open(`${tmpDir}/file`, 'w+');
    file.puts('abcdef');
    file.close();
    try {
      const value = validator.validate(`${tmpDir}/file`, '--argname');
      tester.assertEq(
        value,
        'abcdef',
        "value should be the file content when 'read' was used"
      );
    } finally {
      removeDir(tmpDir);
    }

    let exceptionThrown = false;
    validator = arg.path().read();
    try {
      validator.validate(`${tmpDir}/file`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if file cannot be read'
    );

    tmpDir = createTmpDir();
    validator = arg.path().read({ json: true });
    file = std.open(`${tmpDir}/file`, 'w+');
    file.puts('{"key":"value"}');
    file.close();
    try {
      const value = validator.validate(`${tmpDir}/file`, '--argname');
      tester.assertEq(
        value,
        { key: 'value' },
        "value should be the file content (json) when 'read' was used with {json: true}"
      );
    } finally {
      removeDir(tmpDir);
    }

    tmpDir = createTmpDir();
    exceptionThrown = false;
    validator = arg.path().read({ json: true });
    file = std.open(`${tmpDir}/file`, 'w+');
    file.puts('abcdef');
    file.close();
    try {
      validator.validate(`${tmpDir}/file`, '--argname');
    } catch (e) {
      exceptionThrown = true;
    } finally {
      removeDir(tmpDir);
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if file is not a json file'
    );
  });

  tester.test('arg - number validator (default)', () => {
    let validator = arg.num(1);
    let value = validator.validate(undefined, '--argname');
    tester.assertEq(value, 1, 'value should match default value (1)');

    let exceptionThrown = false;
    try {
      // @ts-ignore
      validator = arg.num('1');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if default value is not a number (1)'
    );

    exceptionThrown = false;
    try {
      // @ts-ignore
      arg.num(1).def('1');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if default value is not a number (2)'
    );

    validator = arg.num(1).def(2);
    value = validator.validate(undefined, '--argname');
    tester.assertEq(value, 2, 'value should match default value (2)');
  });

  tester.test('arg - number validator (range)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.num().min('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'min' argument is not a number"
    );

    let validator = arg.num().min(5);
    try {
      validator.validate('4', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value < min value'
    );

    let value = validator.validate('5', '--argname');
    tester.assertEq(value, 5, 'it should be ok if value >= min value');

    exceptionThrown = false;
    try {
      // @ts-ignore
      arg.str().max('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'max' argument is not a number"
    );

    validator = arg.num().max(5);
    try {
      validator.validate('6', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value > max value'
    );

    value = validator.validate('5', '--argname');
    tester.assertEq(value, 5, 'it should be ok if value <= max value');
  });

  tester.test('arg - number validator (int)', () => {
    let validator = arg.num().int();
    let exceptionThrown = false;
    try {
      validator.validate('6.1', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is not an integer'
    );

    const value = validator.validate('6.0', '--argname');
    tester.assertEq(value, 6, 'it should be ok if value is an integer');
  });

  tester.test('arg - number validator (pos)', () => {
    let validator = arg.num().pos();
    let exceptionThrown = false;
    try {
      validator.validate('0', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is <= 0 but is expected to be > 0'
    );

    let value = validator.validate('1.0', '--argname');
    tester.assertEq(
      value,
      1.0,
      'it should be ok if value is > 0 and is expected to be > 0'
    );

    validator = arg.num().pos(false);
    value = validator.validate('0', '--argname');
    tester.assertEq(
      value,
      0,
      'it should be ok if value is <= 0 is expected to be <= 0'
    );

    exceptionThrown = false;
    try {
      validator.validate('1.0', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is > 0 but is expected to be <= 0'
    );
  });

  tester.test('arg - number validator (neg)', () => {
    let validator = arg.num().neg();
    let exceptionThrown = false;
    try {
      validator.validate('0', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is >= 0 but is expected to be < 0'
    );

    let value = validator.validate('-1.0', '--argname');
    tester.assertEq(
      value,
      -1.0,
      'it should be ok if value is < 0 and is expected to be < 0'
    );

    validator = arg.num().neg(false);
    value = validator.validate('0', '--argname');
    tester.assertEq(
      value,
      0,
      'it should be ok if value is >= 0 is expected to be >= 0'
    );

    exceptionThrown = false;
    try {
      validator.validate('-1.0', '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if value is < 0 but is expected to be >= 0'
    );
  });

  tester.test('arg - flag validator (default)', () => {
    let validator = arg.flag(true);
    let value = validator.validate(undefined, '--argname');
    tester.assertEq(value, true, 'value should match default value (1)');

    let exceptionThrown = false;
    try {
      // @ts-ignore
      validator = arg.flag('1');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if default value is not a boolean (1)'
    );

    exceptionThrown = false;
    try {
      // @ts-ignore
      arg.flag(false).def('true');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if default value is not a boolean (2)'
    );

    validator = arg.flag(false).def(true);
    value = validator.validate(undefined, '--argname');
    tester.assertEq(value, true, 'value should match default value (2)');
  });

  tester.test('arg - flag validator (count)', () => {
    const args = arg(
      {
        '--flag': [arg.flag().count()],
      },
      {
        argv: ['--flag', '--flag', '--flag'],
      }
    );
    tester.assertEq(
      args['--flag'],
      3,
      'value should equal the number of times flag was set'
    );
  });

  tester.test('arg - flag validator (allow --no-x flag)', () => {
    const args = arg(
      {
        '--flag': [arg.flag()],
      },
      {
        argv: ['--no-flag'],
      }
    );
  });

  tester.test('arg - flag validator (disallow --no-x flag)', () => {
    let exceptionThrown = false;

    try {
      const args = arg(
        {
          '--flag': [arg.flag().no(false)],
        },
        {
          argv: ['--no-flag'],
        }
      );
      tester.assertEq(
        args['--flag'],
        3,
        'value should equal the number of times flag was set'
      );
    } catch (e) {
      tester.assertEq(
        e.code,
        'ARG_UNKNOWN_OPTION',
        "it should throw a 'ARG_UNKNOWN_OPTION' exception if --no-x flag is disallowed"
      );
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if --no-x flag is disallowed'
    );
  });

  tester.test('arg - validator (custom)', () => {
    const validator = arg
      .num()
      .cust((val) => {
        if (val === 0) {
          return false;
        }
      })
      .min(5);
    const value = validator.validate('0', '--argname');
    tester.assertEq(
      value,
      0,
      'it should ignore remaining validators if a custom validator returns false'
    );
  });

  tester.test('arg - validator (map)', () => {
    const validator = arg
      .num()
      .min(5)
      .map((value) => ({ value }));
    const value = validator.validate('6', '--argname');
    tester.assertEq(
      value,
      { value: 6 },
      'it should call the "map" function at the end of validation'
    );
  });

  tester.test('arg - validator (req)', () => {
    let exceptionThrown = false;
    try {
      // @ts-ignore
      arg.num().req('str');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      "it should throw an exception if 'isRequired' argument is not a boolean"
    );

    const validator = arg.num().req();
    exceptionThrown = false;
    try {
      validator.validate(undefined, '--argname');
    } catch (e) {
      exceptionThrown = true;
    }
    tester.assert(
      exceptionThrown,
      'it should throw an exception if a required argument was not provided'
    );
  });

  tester.test('arg - validator (env)', () => {
    std.setenv('NUM_VALUE', '4');
    const validator = arg.num().env('NUM_VALUE');
    const value = validator.validate(undefined, '--argname');
    tester.assertEq(value, 4, 'it should retrieve value from environment');
  });

  tester.test('arg - validator (err)', () => {
    const validator = arg.num().min(5).err('Damn!');
    let errMessage;
    try {
      validator.validate('0', '--argname');
    } catch (e) {
      errMessage = e.message;
    }
    tester.assert(
      errMessage.includes('(Damn!)'),
      'it should use a custom error message in case of validation error'
    );
  });

  tester.test('arg - validator (getUsage)', () => {
    let validator = arg.str('defaultValue');
    let usage = validator.getUsage();
    tester.assertEq(
      usage,
      ['(default: defaultValue)'],
      'it should use default value as usage message'
    );

    validator = arg.str().desc('an argument');
    usage = validator.getUsage();
    tester.assertEq(
      usage,
      ['an argument'],
      'it should use the description as usage message'
    );

    validator = arg.str('defaultValue').desc('an argument');
    usage = validator.getUsage();
    tester.assertEq(
      usage,
      ['an argument (default: defaultValue)'],
      'it should use the description and default value as usage message'
    );

    validator = arg.str().enum(['a', 'b', 'c']).desc('an argument');
    usage = validator.getUsage();
    tester.assertEq(
      usage,
      ['an argument', '  - it can be one of [a, b, c]'],
      'it should add the list of possible value as separate line'
    );

    validator = arg.str().desc('an argument');
    usage = validator.getUsage({ allowMany: true });
    tester.assertEq(
      usage,
      ['an argument', '  - it can be set multiple times'],
      'it should add a line to indicate argument can be set multiple times'
    );

    validator = arg.str().desc('an argument').env('VAR');
    usage = validator.getUsage();
    tester.assertEq(
      usage,
      ['an argument', "  - it can be passed as 'VAR' environment variable"],
      'it should add a line to indicate argument can be passed using an environment variable'
    );

    validator = arg.str().desc('a very very very long argument');
    usage = validator.getUsage({ maxLength: 11 });
    tester.assertEq(
      usage,
      ['a very very', 'very long', 'argument'],
      'it should split usage message in lines <= 11 characters'
    );

    let flagValidator = arg.flag(false);
    usage = flagValidator.getUsage();
    tester.assertEq(
      usage,
      [],
      'it should not use default value as usage message if a flag validator is not set by default'
    );

    flagValidator = arg.flag(true);
    usage = flagValidator.getUsage();
    tester.assertEq(
      usage,
      ['(set by default)'],
      'it should use default value as usage message if a flag validator is not set by default'
    );
  });

  tester.test('arg - validator (describeUsage)', () => {
    let validator = arg
      .str('defaultValue')
      .desc('an argument\nwith multiple lines')
      .env('VAR')
      .req()
      .val('MY_VAL')
      .enum(['a', 'b', 'c']);
    let usage = validator.describeUsage('--argname', false, []);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'string',
        default: 'defaultValue',
        values: ['a', 'b', 'c'],
        valueText: 'MY_VAL',
        description: 'an argument\nwith multiple lines',
        shortDescription: 'an argument',
        varName: 'VAR',
        required: true,
        allowMany: false,
        aliases: [],
        format: '',
        allowNoFlags: false,
      },
      'usage description should be as expected (1)'
    );

    validator = arg.str().fmt('email');
    usage = validator.describeUsage('--argname', true, ['-a']);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'string',
        values: [],
        valueText: 'EMAIL',
        description: '',
        shortDescription: '',
        varName: '',
        required: false,
        allowMany: true,
        aliases: ['-a'],
        format: 'email',
        allowNoFlags: false,
      },
      'usage description should be as expected (2)'
    );

    let numValidator = arg.num();
    usage = numValidator.describeUsage('--argname', false, ['-a']);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'number',
        values: [],
        valueText: 'NUM',
        description: '',
        shortDescription: '',
        varName: '',
        required: false,
        allowMany: false,
        aliases: ['-a'],
        format: '',
        allowNoFlags: false,
      },
      'usage description should be as expected (3)'
    );

    let flagValidator = arg.flag();
    usage = flagValidator.describeUsage('--argname', false, ['-a']);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'flag',
        default: false,
        values: [],
        valueText: '',
        description: '',
        shortDescription: '',
        varName: '',
        required: false,
        allowMany: false,
        aliases: ['-a'],
        format: '',
        allowNoFlags: true,
      },
      'usage description should be as expected (4)'
    );

    let pathValidator = arg.path();
    usage = pathValidator.describeUsage('--argname', false, ['-a']);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'file',
        values: [],
        valueText: 'FILE',
        description: '',
        shortDescription: '',
        varName: '',
        required: false,
        allowMany: false,
        aliases: ['-a'],
        format: '',
        allowNoFlags: false,
      },
      'usage description should be as expected (5)'
    );

    pathValidator = arg.path().dir();
    usage = pathValidator.describeUsage('--argname', false, ['-a']);
    tester.assertEq(
      usage,
      {
        name: '--argname',
        type: 'dir',
        values: [],
        valueText: 'DIR',
        description: '',
        shortDescription: '',
        varName: '',
        required: false,
        allowMany: false,
        aliases: ['-a'],
        format: '',
        allowNoFlags: false,
      },
      'usage description should be as expected (6)'
    );
  });

  tester.test('arg - validator (clone)', () => {
    const validator1 = arg
      .str('defaultValue1')
      .enum(['a1', 'b1', 'c1'])
      .desc('an argument')
      .env('VAR1')
      .req(true)
      .min(2);
    const usage1 = validator1.describeUsage('--argname', false, []);

    const validator2 = validator1.clone();
    tester.assertEq(
      validator2.describeUsage('--argname', false, []),
      usage1,
      'usage description of the cloned validator should be the same as source validator'
    );

    validator2
      .enum(['d1', 'e1', 'f1'])
      .def('defaultValue2')
      .desc('another argument')
      .env('VAR2')
      .req(false)
      .min(3);
    const usage2 = validator2.describeUsage('--argname', false, []);
    tester.assertEq(
      validator2.describeUsage('--argname', false, []),
      {
        name: '--argname',
        type: 'string',
        default: 'defaultValue2',
        values: ['d1', 'e1', 'f1'],
        valueText: 'VAL',
        description: 'another argument',
        shortDescription: 'another argument',
        varName: 'VAR2',
        required: false,
        allowMany: false,
        aliases: [],
        format: '',
        allowNoFlags: false,
      },
      "changing the cloned validator should change it's usage description"
    );

    tester.assertEq(
      validator1.describeUsage('--argname', false, []),
      {
        name: '--argname',
        type: 'string',
        default: 'defaultValue1',
        values: ['a1', 'b1', 'c1'],
        valueText: 'VAL',
        description: 'an argument',
        shortDescription: 'an argument',
        varName: 'VAR1',
        required: true,
        allowMany: false,
        aliases: [],
        format: '',
        allowNoFlags: false,
      },
      'changing the cloned validator should not impact the source validator'
    );
    // this should only fail for validator2
    validator1.validate('a1', '--argname');
  });

  tester.test('arg - getHelp', () => {
    const args = arg(
      {
        '--email': arg
          .str('ctn@gmail.com')
          .fmt('email')
          .req()
          .desc('user email'),
        '--enum': [
          arg.str('a').enum(['a', 'b', 'c']).desc('enum argument').env('ENUM'),
        ],
        '--num': arg.num().min(5).max(7),
        '--file': arg.path().desc('file argument'),
        '--dir': arg.path().dir().desc('dir argument'),
        '--flag': arg.flag(true),
        '-e': '--email',
        '-f': '--file',
      },
      {
        help: {
          description: 'Example help header',
          examples: ['--email test@gmail.com -e a', '--file /tmp/test.json'],
        },
        scriptName: 'test',
        parse: false,
      }
    );
    const help = args.getHelp();
    const expectedHelp = std.loadFile('data/help1.txt').trim();
    tester.assertEq(help, expectedHelp, `help should be as expected`);
  });
};
