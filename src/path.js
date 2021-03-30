"use strict;"

import * as os from 'os';

const getScriptDir = () => {
    const arr = scriptArgs[0].split('/');
    // only a single entry (ie: we're in the same directory) => return cwd
    if (1 === arr.length) {
        return os.getcwd()[0];
    }
    // remove last entry
    arr.pop();
    return arr.join('/');
}

const getScriptName = (withoutExt) => {
    if (undefined === withoutExt) {
        withoutExt = false;
    }
    let arr = scriptArgs[0].split('/');
    let script = arr.pop();
    if (!withoutExt) {
        return script;
    }
    arr = script.split('.');
    if (1 == arr.length) {
        return script;
    }
    return arr.slice(0, -1).join('.');
}

export {
    getScriptDir,
    getScriptName
}
