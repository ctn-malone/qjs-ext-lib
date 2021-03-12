import { exec } from '../../src/process.js';

/*
    - start sleep command
    - run date command
    - wait for sleep command to stop
    - run date command
 */

const main = async () => {
    let output;
    
    const p = exec('sleep 5s');
    
    output = await exec('date');
    console.log(`date #1 => ${output}`);

    await p;
    console.log(`sleep command finished`);

    output = await exec('date');
    console.log(`date #2 => ${output}`);
}

main();