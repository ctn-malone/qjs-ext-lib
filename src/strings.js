"use strict;"

/*
    String helpers. Mostly for internal use
 */


/**
 * Convert an {Uint8Array} to string
 * Can be used after {os.read}
 *
 * @param {Uint8Array} array to convert
 * @param {integer} len array length (optional)
 *
 * @return {string}
 */
const bytesArrayToStr = (array, len) => {
    if (undefined === len) {
        len = array.length;
    }

    let finalStr = '';
    let i = 0;
    let char, char2, char3, tmpStr;

    while (i < len) {
        char = array[i++];
        if (0 == char) {
            continue;
        }
        switch (char >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                tmpStr = String.fromCharCode(char);
                finalStr += tmpStr;
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                tmpStr = String.fromCharCode(((char & 0x1F) << 6) | (char2 & 0x3F));
                finalStr += tmpStr;
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                tmpStr = String.fromCharCode(((char & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
                finalStr += tmpStr;
                break;
        }
    }

    return finalStr;
}

/**
 * Convert a {string} to a {Uint8Array}
 * Can be use with {os.write}
 *
 * Borrowed from https://gist.github.com/joni/3760795
 *
 * @param {string} str string to convert
 *
 * @return {Uint8Array}
 */
const strToBytesArray = (str) => {
    const arr = [];
    let charCode;

    for (let i = 0, length = str.length; i < length; ++i) {
        charCode = str.charCodeAt(i);
        if (charCode < 0x80) {
            arr.push(charCode);
        }
        else if (charCode < 0x800) {
            arr.push(0xc0 | (charCode >> 6),
                     0x80 | (charCode & 0x3f));
        }
        else if (charCode < 0xd800 || charCode >= 0xe000) {
            arr.push(0xe0 | (charCode >> 12),
                     0x80 | ((charCode>>6) & 0x3f),
                     0x80 | (charCode & 0x3f));
        }
        // surrogate pair
        else {
            ++i;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charCode = 0x10000 + (((charCode & 0x3ff)<<10) | (str.charCodeAt(i) & 0x3ff));
            arr.push(0xf0 | (charCode >>18),
                      0x80 | ((charCode>>12) & 0x3f),
                      0x80 | ((charCode>>6) & 0x3f),
                      0x80 | (charCode & 0x3f));
        }
    }
    return Uint8Array.from(arr);
}

/**
 * Split a string into multiple lines
 *
 * @param {string} content new content to split
 * @param {string} incompleteLine previous incomplete line
 * @param {boolean} skipBlankLines if {true} empty lines will be ignored (default = {false})
 *
 * @return {object} {lines:string[], incompleteLine:string}
 */
const getLines = (content, incompleteLine, skipBlankLines = false) => {
    if (undefined === incompleteLine) {
        incompleteLine = '';
    }
    const lines = [];
    let index;
    let start = 0;
    let str;
    while (-1 != (index = content.indexOf("\n", start))) {
        str = content.substring(start, index);
        // remove '\r' character in case we have one
        if (str.endsWith('\r')) {
            str = str.slice(0, -1);
        }
        start = index + 1;
        incompleteLine += str;
        // ignore empty lines if requested
        if ('' == incompleteLine) {
            if (!skipBlankLines) {
                lines.push(incompleteLine);
            }
        }
        else {
            lines.push(incompleteLine);
            incompleteLine = '';
        }
    }
    incompleteLine += content.substring(start);
    const result = {
        lines:lines,
        incompleteLine:incompleteLine
    };
    return result;
}

export {
    bytesArrayToStr,
    strToBytesArray,
    getLines
}
