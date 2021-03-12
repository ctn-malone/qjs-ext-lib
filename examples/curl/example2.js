import { Curl, multiCurl } from '../../src/curl.js';

/*
    Perform multiple GET requests to https://jsonplaceholder.typicode.com/posts in parallel and print response payload
 */

const main = async () => {
    const requests = [];
    for (let i = 1; i < 4; ++i) {
        requests.push(new Curl(`https://jsonplaceholder.typicode.com/posts/${i}`));
    }
    const responses = (await multiCurl(requests)).map((e => e.curl.body));
    console.log(JSON.stringify(responses, null, 4));
}

main();