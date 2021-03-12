import { tester } from '../../src/tester.js';
import { getScriptName } from '../../src/path.js'

export default () => {

    tester.test('path.getScriptName', () => {
        let name;
        name = getScriptName(false);
        tester.assert(name == 'run.js', `script name with extension should be 'run.js' (${name})`);
        name = getScriptName(true);
        tester.assert(name == 'run', `script name without extension should be 'run' (${name})`);
    });
}