import * as os from 'os';
import * as std from 'std';
import { tester } from '../../src/tester.js';
import { utf8ArrayToStr, getLines } from '../../src/strings.js'

export default () => {

    tester.test('strings.utf8ArrayToStr (without length)', () => {
        const filepath = 'data/file1.txt';
        // read file using a buffer
        const buffer = new Uint8Array(1024);
        const fd = os.open(filepath);
        const len = os.read(fd, buffer.buffer, 0, buffer.length);
        // call method without the expected length
        const contentFromBuffer = utf8ArrayToStr(buffer).trim();
        // read file using std
        const content = std.loadFile(filepath).trim();
        tester.assert(contentFromBuffer.length == content.length, `converted buffer should have a length of ${content.length} (${contentFromBuffer.length})`);
        tester.assert(contentFromBuffer == content, `converted buffer should match string`);
        // in case we don't have a match, identify first non-matching character
        if (contentFromBuffer != content && contentFromBuffer.length == content.length) {
            for (let i = 0; i < content.length; ++i) {
                if (content[i] != contentFromBuffer[i]) {
                    tester.assert(false, `converted character at pos ${i} should be a '${content[i]}' (${contentFromBuffer[i]})`);
                    break;
                }
            }
        }
    });

    tester.test('strings.utf8ArrayToStr (with length)', () => {
        const filepath = 'data/file1.txt';
        // read file using a buffer
        const buffer = new Uint8Array(1024);
        const fd = os.open(filepath);
        const len = os.read(fd, buffer.buffer, 0, buffer.length);
        // call method with the expected length
        const contentFromBuffer = utf8ArrayToStr(buffer, len).trim();
        // read file using std
        const content = std.loadFile(filepath).trim();
        tester.assert(contentFromBuffer.length == content.length, `converted buffer should have a length of ${content.length} (${contentFromBuffer.length})`);
        tester.assert(contentFromBuffer == content, `converted buffer should match string`);
        // in case we don't have a match, identify first non-matching character
        if (contentFromBuffer != content && contentFromBuffer.length == content.length) {
            for (let i = 0; i < content.length; ++i) {
                if (content[i] != contentFromBuffer[i]) {
                    tester.assert(false, `converted character at pos ${i} should be a '${content[i]}' (${contentFromBuffer[i]})`);
                    break;
                }
            }
        }
    });

    tester.test('strings.getLines', () => {
        let str, result, expectedResult;
        
        str = " a\nb\n\n\c\nd ";
        result = getLines(str, undefined, false);
        expectedResult = {lines:[' a', 'b', '', 'c'], incompleteLine:'d '};
        tester.assertEq(result, expectedResult, 'Result should be as expected');

        str = " a\nb\n\n\c\nd ";
        result = getLines(str, undefined, true);
        expectedResult = {lines:[' a', 'b', 'c'], incompleteLine:'d '};
        tester.assertEq(result, expectedResult, 'Result should be as expected');

        str = " a\nb\n\n\c\nd ";
        result = getLines(str, 'incomplete ', false);
        expectedResult = {lines:['incomplete  a', 'b', '', 'c'], incompleteLine:'d '};
        tester.assertEq(result, expectedResult, 'Result should be as expected');

        str = " a\nb\n\n\c\nd ";
        result = getLines(str, 'incomplete ', true);
        expectedResult = {lines:['incomplete  a', 'b', 'c'], incompleteLine:'d '};
        tester.assertEq(result, expectedResult, 'Result should be as expected');
    });

}