/** @format */
// @ts-check

// @ts-ignore
import * as os from 'os';
// @ts-ignore
import * as std from 'std';

import { tester } from '../../src/tester.js';
import {
  bytesArrayToStr,
  strToBytesArray,
  getLines,
  base64EncodeStr,
  base64DecodeStr,
  base64EncodeBytesArray,
  base64DecodeBytesArray,
} from '../../src/strings.js';

export default () => {
  tester.test('strings.bytesArrayToStr (without opt)', () => {
    const filepath = 'data/file1.txt';
    // read file using a buffer
    const buffer = new Uint8Array(1024);
    // @ts-ignore
    const fd = os.open(filepath);
    // @ts-ignore
    const len = os.read(fd, buffer.buffer, 0, buffer.length);
    // call method without the expected length
    const contentFromBuffer = bytesArrayToStr(buffer).trim();
    // read file using std
    const content = std.loadFile(filepath).trim();
    tester.assert(
      contentFromBuffer.length == content.length,
      `converted buffer should have a length of ${content.length} (${contentFromBuffer.length})`
    );
    tester.assert(
      contentFromBuffer == content,
      `converted buffer should match string`
    );
    // in case we don't have a match, identify first non-matching character
    if (
      contentFromBuffer != content &&
      contentFromBuffer.length == content.length
    ) {
      for (let i = 0; i < content.length; ++i) {
        if (content[i] != contentFromBuffer[i]) {
          tester.assert(
            false,
            `converted character at pos ${i} should be a '${content[i]}' (${contentFromBuffer[i]})`
          );
          break;
        }
      }
    }
  });

  tester.test('strings.bytesArrayToStr (with opt)', () => {
    const filepaths = ['data/file1.txt', 'data/file2.txt'];
    for (const filepath of filepaths) {
      // read file using a buffer
      const buffer = new Uint8Array(1024);
      // @ts-ignore
      const fd = os.open(filepath);
      // @ts-ignore
      const len = os.read(fd, buffer.buffer, 0, buffer.length);
      // call method with the expected length
      const contentFromBuffer = bytesArrayToStr(buffer, {
        from: 0,
        to: len,
      }).trim();
      // read file using std
      const content = std.loadFile(filepath).trim();
      tester.assert(
        contentFromBuffer.length == content.length,
        `converted buffer (${filepath}) should have a length of ${content.length} (${contentFromBuffer.length})`
      );
      tester.assert(
        contentFromBuffer == content,
        `converted buffer (${filepath}) should match string`
      );
      // in case we don't have a match, identify first non-matching character
      if (
        contentFromBuffer != content &&
        contentFromBuffer.length == content.length
      ) {
        for (let i = 0; i < content.length; ++i) {
          if (content[i] != contentFromBuffer[i]) {
            tester.assert(
              false,
              `converted character at pos ${i} (${filepath}) should be a '${content[i]}' (${contentFromBuffer[i]})`
            );
            break;
          }
        }
      }
    }
    const buffer = new Uint8Array(26);
    let str = '';
    for (let i = 0; i < 26; ++i) {
      const code = 'a'.charCodeAt(0) + i;
      const char = String.fromCharCode(code);
      str += char;
      buffer[i] = code;
    }
    let fromIndex = 5;
    let toIndex = 10;
    let opt = { from: fromIndex, to: toIndex };
    let expectedResult = str.substring(fromIndex, toIndex);
    let contentFromBuffer = bytesArrayToStr(buffer, opt).trim();
    tester.assert(
      contentFromBuffer.length == expectedResult.length,
      `converted buffer with ${JSON.stringify(opt)} should have a length of ${
        expectedResult.length
      } (${contentFromBuffer.length})`
    );
    tester.assertEq(
      contentFromBuffer,
      expectedResult,
      `converted buffer with ${JSON.stringify(
        opt
      )} should match string (${expectedResult})`
    );
    // try with a 'to' > buffer size
    fromIndex = 5;
    toIndex = 50;
    opt = { from: fromIndex, to: toIndex };
    expectedResult = str.substring(fromIndex, toIndex);
    contentFromBuffer = bytesArrayToStr(buffer, opt).trim();
    tester.assert(
      contentFromBuffer.length == expectedResult.length,
      `converted buffer with ${JSON.stringify(opt)} should have a length of ${
        expectedResult.length
      } (${contentFromBuffer.length})`
    );
    tester.assertEq(
      contentFromBuffer,
      expectedResult,
      `converted buffer with ${JSON.stringify(
        opt
      )} should match string (${expectedResult})`
    );
  });

  tester.test('strings.strToBytesArray (without opt)', () => {
    const filepath = 'data/file2.txt';
    // read file using a buffer
    const initialBuffer = new Uint8Array(1024);
    // @ts-ignore
    const fd = os.open(filepath);
    // @ts-ignore
    const len = os.read(fd, initialBuffer.buffer, 0, initialBuffer.length);
    const file = std.open('data/file2.txt', 'r');
    const content = file.readAsString();
    const convertedBuffer = strToBytesArray(content);
    // in case we don't have a match, identify first non-matching character
    let i;
    for (i = 0; i < convertedBuffer.length; ++i) {
      if (convertedBuffer[i] != initialBuffer[i]) {
        tester.assert(
          false,
          `converted bytes at pos ${i} should have a value of '${initialBuffer[i]}' (${convertedBuffer[i]})`
        );
        break;
      }
    }
    if (convertedBuffer.length == i) {
      tester.assert(true, `converted buffer should match initial buffer`);
    }
  });

  tester.test('strings.strToBytesArray (with opt)', () => {
    const buffer = new Uint8Array(52);
    let str = '';
    let i = 0;
    for (i = 0; i < 26; ++i) {
      const code = 'a'.charCodeAt(0) + i;
      const char = String.fromCharCode(code);
      str += char;
    }
    const opt = { bytesArray: buffer, from: 26, to: 52 };
    const convertedBuffer = strToBytesArray(str, opt);
    tester.assert(
      convertedBuffer.length == 26,
      `converted buffer should have a length of 26 (${convertedBuffer.length})`
    );
    for (i = 0; i < 26; ++i) {
      const code = 'a'.charCodeAt(0) + i;
      if (convertedBuffer[i] != code) {
        tester.assert(
          false,
          `converted bytes at pos ${i} should have a value of ${code} (${convertedBuffer[i]})`
        );
        break;
      }
      if (buffer[i + 26] != code) {
        tester.assert(
          false,
          `bytes at pos ${i + 26} should have a value of ${code} (${
            buffer[i + 26]
          })`
        );
        break;
      }
    }
    if (26 == i) {
      tester.assert(true, `converted buffer should match expected result`);
      tester.assert(true, `initial buffer should match expected result`);
    }
  });

  tester.test('strings.getLines', () => {
    let str, result, expectedResult;

    str = ' a\nb\n\nc\nd ';
    result = getLines(str, undefined, false);
    expectedResult = { lines: [' a', 'b', '', 'c'], incompleteLine: 'd ' };
    tester.assertEq(result, expectedResult, 'Result should be as expected');

    str = ' a\nb\n\nc\nd ';
    result = getLines(str, undefined, true);
    expectedResult = { lines: [' a', 'b', 'c'], incompleteLine: 'd ' };
    tester.assertEq(result, expectedResult, 'Result should be as expected');

    str = ' a\nb\n\nc\nd ';
    result = getLines(str, 'incomplete ', false);
    expectedResult = {
      lines: ['incomplete  a', 'b', '', 'c'],
      incompleteLine: 'd ',
    };
    tester.assertEq(result, expectedResult, 'Result should be as expected');

    str = ' a\nb\n\nc\nd ';
    result = getLines(str, 'incomplete ', true);
    expectedResult = {
      lines: ['incomplete  a', 'b', 'c'],
      incompleteLine: 'd ',
    };
    tester.assertEq(result, expectedResult, 'Result should be as expected');
  });

  tester.test(
    'strings.base64EncodeStr',
    async (done) => {
      const plainStr = `
GNU coreutils online help: <https://www.gnu.org/software/coreutils/>
Full documentation <https://www.gnu.org/software/coreutils/base64>
      `.trim();
      const base64Str = await base64EncodeStr(plainStr);
      tester.assertEq(
        base64Str,
        'R05VIGNvcmV1dGlscyBvbmxpbmUgaGVscDogPGh0dHBzOi8vd3d3LmdudS5vcmcvc29mdHdhcmUvY29yZXV0aWxzLz4KRnVsbCBkb2N1bWVudGF0aW9uIDxodHRwczovL3d3dy5nbnUub3JnL3NvZnR3YXJlL2NvcmV1dGlscy9iYXNlNjQ+',
        'Base64 string should match'
      );
      done();
    },
    { isAsync: true }
  );

  tester.test(
    'strings.base64DecodeStr',
    async (done) => {
      const base64Str =
        'R05VIGNvcmV1dGlscyBvbmxpbmUgaGVscDogPGh0dHBzOi8vd3d3LmdudS5vcmcvc29mdHdhcmUvY29yZXV0aWxzLz4KRnVsbCBkb2N1bWVudGF0aW9uIDxodHRwczovL3d3dy5nbnUub3JnL3NvZnR3YXJlL2NvcmV1dGlscy9iYXNlNjQ+';
      const plainStr = await base64DecodeStr(base64Str);
      tester.assertEq(
        plainStr,
        `
GNU coreutils online help: <https://www.gnu.org/software/coreutils/>
Full documentation <https://www.gnu.org/software/coreutils/base64>
        `.trim(),
        'Plain string should match'
      );
      done();
    },
    { isAsync: true }
  );

  tester.test(
    'strings.base64EncodeBytesArray',
    async (done) => {
      const bytesArray = new Uint8Array(50);
      for (let i = 0; i < bytesArray.length; ++i) {
        bytesArray[i] = i % 256;
      }
      const base64Str = await base64EncodeBytesArray(bytesArray);
      tester.assertEq(
        base64Str,
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDE=',
        'Base64 string should match'
      );
      done();
    },
    { isAsync: true }
  );

  tester.test(
    'strings.base64DecodeBytesArray',
    async (done) => {
      const expectedBytesArray = new Uint8Array(50);
      for (let i = 0; i < expectedBytesArray.length; ++i) {
        expectedBytesArray[i] = i % 256;
      }
      const base64Str =
        'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDE=';
      const bytesArray = await base64DecodeBytesArray(base64Str);
      tester.assertEq(
        bytesArray,
        expectedBytesArray,
        'BytesArray should match'
      );
      done();
    },
    { isAsync: true }
  );
};
