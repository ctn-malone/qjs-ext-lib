/** @format */

import { tester } from '../../src/tester.js';
import { version } from '../../src/version.js';

export default () => {
  tester.test('version (lib version)', () => {
    tester.assert(
      undefined !== version.VERSION,
      `lib version should be defined`
    );
  });

  tester.test('version (semver)', () => {
    ['1.0.0', '1.0.0-alpha', '1.0.0-0.3.7+exp.sha.5114f85'].forEach((v) => {
      tester.assert(
        version.isSemver(v),
        `'${v}' should be a valid semver version`
      );
      const converted = version.convert(v);
      tester.assertEq(
        converted,
        v,
        `'${v}' should remain unchanged after conversion`
      );
    });
  });

  tester.test('version (non semver)', () => {
    [
      version.eq,
      version.neq,
      version.lt,
      version.lte,
      version.gt,
      version.gte,
    ].forEach((fn) => {
      let exception;
      try {
        fn('a.b.c');
      } catch (e) {
        exception = e;
      }
      tester.assert(
        undefined !== exception,
        `'${fn.name}' should throw an exception when using a non semver version as first argument`
      );
      exception = undefined;
      try {
        fn('1.0.0', 'a.b.c');
      } catch (e) {
        exception = e;
      }
      tester.assert(
        undefined !== exception,
        `'${fn.name}' should throw an exception when using a non semver version as second argument`
      );
    });
    [
      { from: '1.0.0a', to: '1.0.0' },
      { from: '1.0.0-a@b', to: '1.0.0' },
      { from: '1.0.0-alpha+a@b', to: '1.0.0' },
    ].forEach((e) => {
      tester.assert(
        !version.isSemver(e.from),
        `'${e.from}' should not be a valid semver version`
      );
      const converted = version.convert(e.from);
      tester.assertEq(
        converted,
        e.to,
        `'${e.from}' should be converted to '${e.to}'`
      );
    });
  });

  tester.test('version (eq)', () => {
    let current = '1.0.0';
    const target = '1.0.0';
    tester.assert(version.eq(target, current), `${current} == ${target}`);
    current = '1.0.1';
    tester.assert(
      !version.eq(target, current),
      `not (${current} == ${target})`
    );
  });

  tester.test('version (neq)', () => {
    let current = '1.0.1';
    const target = '1.0.0';
    tester.assert(version.neq(target, current), `${current} != ${target}`);
    current = '1.0.0';
    tester.assert(
      !version.neq(target, current),
      `not (${current} != ${target})`
    );
  });

  tester.test('version (lt)', () => {
    let current = '1.0.0';
    let target = '1.0.1';
    tester.assert(version.lt(target, current), `${current} < ${target}`);
    current = '1.0.1';
    tester.assert(!version.lt(target, current), `not (${current} < ${target})`);
    current = '1.0.2';
    tester.assert(!version.lt(target, current), `not (${current} < ${target})`);
    target = '0.5.0';
    current = '0.4.0';
    tester.assert(version.lt(target, current), `${current} < ${target}`);
    current = '0.5.0';
    tester.assert(!version.lt(target, current), `not (${current} < ${target})`);
    current = '0.6.0';
    tester.assert(!version.lt(target, current), `not (${current} < ${target})`);
    current = '0.15.1';
    target = '0.16.0';
    tester.assert(version.lt(target, current), `${current} < ${target}`);
    target = '0.15.1';
    current = '0.16.0';
    tester.assert(!version.lt(target, current), `not (${current} < ${target})`);
  });

  tester.test('version (lte)', () => {
    let current = '1.0.0';
    let target = '1.0.1';
    tester.assert(version.lte(target, current), `${current} <= ${target}`);
    current = '1.0.1';
    tester.assert(version.lte(target, current), `${current} <= ${target}`);
    current = '1.0.2';
    tester.assert(
      !version.lte(target, current),
      `not (${current} <= ${target})`
    );
    target = '0.5.0';
    current = '0.4.0';
    tester.assert(version.lte(target, current), `${current} <= ${target}`);
    current = '0.5.0';
    tester.assert(version.lte(target, current), `${current} <= ${target}`);
    current = '0.6.0';
    tester.assert(
      !version.lte(target, current),
      `not (${current} <= ${target})`
    );
  });

  tester.test('version (gt)', () => {
    let current = '1.0.2';
    let target = '1.0.1';
    tester.assert(version.gt(target, current), `${current} > ${target}`);
    current = '1.0.1';
    tester.assert(!version.gt(target, current), `not (${current} > ${target})`);
    current = '1.0.0';
    tester.assert(!version.gt(target, current), `not (${current} > ${target})`);
    target = '0.4.0';
    current = '0.5.0';
    tester.assert(version.gt(target, current), `${current} > ${target}`);
    current = '0.4.0';
    tester.assert(!version.gt(target, current), `not (${current} > ${target})`);
    current = '0.3.0';
    tester.assert(!version.gt(target, current), `not (${current} > ${target})`);
    target = '0.15.1';
    current = '0.16.0';
    tester.assert(version.gt(target, current), `${current} > ${target}`);
    current = '0.15.1';
    target = '0.16.0';
    tester.assert(!version.gt(target, current), `not (${current} > ${target})`);
  });

  tester.test('version (gte)', () => {
    let current = '1.0.2';
    let target = '1.0.1';
    tester.assert(version.gte(target, current), `${current} >= ${target}`);
    current = '1.0.1';
    tester.assert(version.gte(target, current), `${current} >= ${target}`);
    current = '1.0.0';
    tester.assert(
      !version.gte(target, current),
      `not (${current} >= ${target})`
    );
    target = '0.4.0';
    current = '0.5.0';
    tester.assert(version.gte(target, current), `${current} >= ${target}`);
    current = '0.4.0';
    tester.assert(version.gte(target, current), `${current} >= ${target}`);
    current = '0.3.0';
    tester.assert(
      !version.gte(target, current),
      `not (${current} >= ${target})`
    );
  });
};
