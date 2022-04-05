import * as os from 'os';
import * as std from 'std';
import { tester } from '../../src/tester.js';
import { bytesArrayToStr, strToBytesArray, getLines } from '../../src/strings.js'

export default () => {

    tester.test('strings.bytesArrayToStr (without length)', () => {
        const filepath = 'data/file1.txt';
        // read file using a buffer
        const buffer = new Uint8Array(1024);
        const fd = os.open(filepath);
        const len = os.read(fd, buffer.buffer, 0, buffer.length);
        // call method without the expected length
        const contentFromBuffer = bytesArrayToStr(buffer).trim();
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

    tester.test('strings.bytesArrayToStr (with length)', () => {
        const filepaths = [
            'data/file1.txt',
            'data/file2.txt'
        ];
        for (const filepath of filepaths) {
            // read file using a buffer
            const buffer = new Uint8Array(1024);
            const fd = os.open(filepath);
            const len = os.read(fd, buffer.buffer, 0, buffer.length);
            // call method with the expected length
            const contentFromBuffer = bytesArrayToStr(buffer, len).trim();
            // read file using std
            const content = std.loadFile(filepath).trim();
            tester.assert(contentFromBuffer.length == content.length, `converted buffer (${filepath}) should have a length of ${content.length} (${contentFromBuffer.length})`);
            tester.assert(contentFromBuffer == content, `converted buffer (${filepath}) should match string`);
            // in case we don't have a match, identify first non-matching character
            if (contentFromBuffer != content && contentFromBuffer.length == content.length) {
                for (let i = 0; i < content.length; ++i) {
                    if (content[i] != contentFromBuffer[i]) {
                        tester.assert(false, `converted character at pos ${i} (${filepath}) should be a '${content[i]}' (${contentFromBuffer[i]})`);
                        break;
                    }
                }
            }
        }
    });

    tester.test('strings.strToBytesArray', () => {
        const filepath = 'data/file2.txt';
        // read file using a buffer
        const initialBuffer = new Uint8Array(1024);
        const fd = os.open(filepath);
        const len = os.read(fd, initialBuffer.buffer, 0, initialBuffer.length);
        const file = std.open('data/file2.txt', 'r');
        const content = file.readAsString();
        const convertedBuffer = strToBytesArray(content);
        // in case we don't have a match, identify first non-matching character
        let i;
        for (i = 0; i < convertedBuffer.length; ++i) {
            if (convertedBuffer[i] != initialBuffer[i]) {
                tester.assert(false, `converted bytes at pos ${i} should have a value of '${initialBuffer[i]}' (${convertedBuffer[i]})`);
                break;
            }
        }
        if (convertedBuffer.length == i) {
            tester.assert(true, `converted buffer should match initial buffer`);
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