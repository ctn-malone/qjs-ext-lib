"use strict;"

/*
    String helpers. Mostly for internal use
 */


/**
 * Convert an {Uint8Array} with utf8 data to string
 *
 * @param {Uint8Array} array
 * @param {integer} len array length (optional)
 *
 * @return {string}
 */
const utf8ArrayToStr = (array, len) => {
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

export {
    utf8ArrayToStr
}
