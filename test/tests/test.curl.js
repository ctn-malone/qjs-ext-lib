/** @format */

import * as std from 'std';
import { tester } from '../../src/tester.js';
import { Curl, curlRequest, multiCurl } from '../../src/curl.js';

export default () => {
  tester.test('curl.Curl (methods)', () => {
    for (const m of [
      'get',
      'post',
      'delete',
      'put',
      'head',
      'patch',
      'options',
    ]) {
      const c = new Curl('http://127.0.0.1', { method: m });
      const method = m.toUpperCase();
      const expectedCmdline = `curl -D /dev/stderr -q -X ${method} -L --url http://127.0.0.1`;
      const cmdline = c.cmdline;
      tester.assertEq(
        cmdline,
        expectedCmdline,
        `cmdline should match when using '${method}' method`
      );
    }
    const m = 'invalid';
    const c = new Curl('http://127.0.0.1', { method: m });
    const method = m.toUpperCase();
    const expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1`;
    const cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `method should be ignored when using invalid method '${method}'`
    );
  });

  tester.test('curl.Curl (user-agent)', () => {
    const c = new Curl('http://127.0.0.1', {
      userAgent: 'myUserAgent',
    });
    const expectedCmdline = `curl -D /dev/stderr -q -A myUserAgent -X GET -L --url http://127.0.0.1`;
    const cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using a specific user-agent`
    );
  });

  tester.test('curl.Curl (insecure SSL)', () => {
    const c = new Curl('http://127.0.0.1', {
      insecure: true,
    });
    const expectedCmdline = `curl -D /dev/stderr -q -k -X GET -L --url http://127.0.0.1`;
    const cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using {insecure:true}`
    );
  });

  tester.test('curl.Curl (extra headers)', () => {
    const c = new Curl('http://127.0.0.1', {
      headers: {
        'X-Custom-Header1': 'value1',
        'X-custom-Header2': 'value2',
      },
    });
    const expectedCmdline = `curl -D /dev/stderr -q -H X-Custom-Header1: value1 -H X-custom-Header2: value2 -X GET -L --url http://127.0.0.1`;
    const cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using custom headers`
    );
  });

  tester.test('curl.Curl (cookies)', () => {
    let c;
    let expectedCmdline;
    let cmdline;
    c = new Curl('http://127.0.0.1', {
      cookies: {
        cookie1: 'value1',
        cookie2: 'value2',
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -H Cookie: cookie1=value1; cookie2=value2 -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using cookies (when using string as values)`
    );
    c = new Curl('http://127.0.0.1', {
      cookies: {
        cookie1: { value: 'value1' },
        cookie2: { value: 'value2' },
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -H Cookie: cookie1=value1; cookie2=value2 -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using cookies (when using objects as values)`
    );
  });

  tester.test('curl.Curl (follow redirects)', () => {
    let c = new Curl('http://127.0.0.1', {
      maxRedirects: 4,
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X GET -L --max-redirs 4 --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using {maxRedirects:4}`
    );

    c = new Curl('http://127.0.0.1', {
      followRedirects: false,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using {followRedirect:false}`
    );
  });

  tester.test('curl.Curl (output file)', () => {
    const c = new Curl('http://127.0.0.1', {
      outputFile: '/tmp/output.html',
    });
    const expectedCmdline = `curl -D /dev/stderr -q -X GET -L -o /tmp/output.html --url http://127.0.0.1`;
    const cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when defining an output file`
    );
  });

  tester.test('curl.Curl (timeouts)', () => {
    let c = new Curl('http://127.0.0.1', {
      connectTimeout: 5,
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X GET -L --connect-timeout 5 --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using {connectTimeout:5}`
    );

    c = new Curl('http://127.0.0.1', {
      connectTimeout: 'notANumber',
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should not contain '--connect-timeout' when using a value which is not a positive number`
    );

    c = new Curl('http://127.0.0.1', {
      maxTime: 10,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --max-time 10 --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using {maxTime:10}`
    );

    c = new Curl('http://127.0.0.1', {
      maxTime: 'notANumber',
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should not contain '--max-time' when using a value which is not a positive number`
    );
  });

  tester.test('curl.Curl (auth)', () => {
    let c = new Curl('http://127.0.0.1', {
      basicAuth: {
        username: 'myUsername',
        password: 'myPassword',
      },
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X GET -L -u myUsername:myPassword --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when basic auth`
    );

    c = new Curl('http://127.0.0.1', {
      basicAuth: {
        password: 'myPassword',
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should not contain any auth when username is missing`
    );

    c = new Curl('http://127.0.0.1', {
      basicAuth: {
        username: 'myUsername',
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should not contain any auth when password is missing`
    );

    c = new Curl('http://127.0.0.1', {
      bearerToken: 'myToken',
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L -H Authorization: Bearer myToken --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when a bearer token is defined`
    );
  });

  tester.test('curl.Curl (send x-www-form-urlencoded data)', () => {
    let c = new Curl('http://127.0.0.1', {
      method: 'post',
      data: {
        param1: 'value1&',
        param2: 'value2=',
      },
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X POST -L -H Content-Type: application/x-www-form-urlencoded -d param1=value1%26 -d param2=value2%3D --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using scalar values as data`
    );

    c = new Curl('http://127.0.0.1', {
      method: 'post',
      data: {
        array1: ['value1', 'value2&='],
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L -H Content-Type: application/x-www-form-urlencoded -d array1[]=value1 -d array1[]=value2%26%3D --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using arrays as data`
    );

    ['get', 'head', 'options'].forEach((m) => {
      c = new Curl('http://127.0.0.1', {
        method: m,
        data: {
          param1: 'value1&',
          param2: 'value2=',
        },
      });
      const method = m.toUpperCase();
      expectedCmdline = `curl -D /dev/stderr -q -X ${method} -L --url http://127.0.0.1`;
      cmdline = c.cmdline;
      tester.assertEq(
        cmdline,
        expectedCmdline,
        `cmdline should not contain any data when using data with '${method}' method`
      );
    });
  });

  tester.test('curl.Curl (send file)', () => {
    let c = new Curl('http://127.0.0.1', {
      method: 'post',
      file: '/tmp/file.png',
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X POST -L -F file=@/tmp/file.png --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using a string as 'file' option`
    );

    let opt = { filepath: '/tmp/file.png' };
    c = new Curl('http://127.0.0.1', {
      method: 'post',
      file: opt,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L -F file=@/tmp/file.png --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(opt)} as 'file' option`
    );

    opt = { filepath: '/tmp/file.png', name: 'myFile' };
    c = new Curl('http://127.0.0.1', {
      method: 'post',
      file: opt,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L -F myFile=@/tmp/file.png --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(opt)} as 'file' option`
    );

    opt = { filepath: '/tmp/file.png', name: 'myFile', filename: 'file2.png' };
    c = new Curl('http://127.0.0.1', {
      method: 'post',
      file: opt,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L -F myFile=@/tmp/file.png;filename=file2.png --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(opt)} as 'file' option`
    );
  });

  tester.test('curl.Curl (send file with extra form data)', () => {
    let opt = {
      filepath: '/tmp/file.png',
      formData: {
        key1: 'value1',
        key2: JSON.stringify({ a: 1, b: 2 }),
      },
    };
    let c = new Curl('http://127.0.0.1', {
      method: 'post',
      file: opt,
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X POST -L -F file=@/tmp/file.png -F key1=value1 -F key2={\"a\":1,\"b\":2} --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(opt)} as 'file' option`
    );
  });

  tester.test('curl.Curl (send raw body)', () => {
    let c = new Curl('http://127.0.0.1', {
      method: 'post',
      body: 'myBody',
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X POST -L -d myBody --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when passing a string as raw body`
    );

    c = new Curl('http://127.0.0.1', {
      method: 'post',
      body: {},
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should not contain any data when using a non-string as raw body`
    );
  });

  tester.test(`curl.Curl (send raw body from file)`, () => {
    let c = new Curl('http://127.0.0.1', {
      method: 'post',
      bodyFile: 'body.txt',
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X POST -L -d @body.txt --url http://127.0.0.1`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using a string as 'bodyFile' option`
    );

    let opt = { filepath: 'body.txt' };
    c = new Curl('http://127.0.0.1', {
      method: 'post',
      bodyFile: opt,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L -d @body.txt --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(
        opt
      )} as 'bodyFile' option`
    );

    opt = { filepath: 'body.txt', binary: true };
    c = new Curl('http://127.0.0.1', {
      method: 'post',
      bodyFile: opt,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X POST -L --data-binary @body.txt --url http://127.0.0.1`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using ${JSON.stringify(
        opt
      )} as 'bodyFile' option`
    );
  });

  tester.test('curl.Curl (send query parameters)', () => {
    let c = new Curl('http://127.0.0.1', {
      params: {
        param1: 'value1&',
        param2: 'value2=',
      },
    });
    let expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1?param1=value1%26&param2=value2%3D`;
    let cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using scalar values as query params`
    );

    c = new Curl('http://127.0.0.1?param0=value0', {
      params: {
        param1: 'value1',
        param2: 'value2',
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1?param0=value0&param1=value1&param2=value2`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when initial url already contains query parameters`
    );

    c = new Curl('http://127.0.0.1', {
      params: {
        array1: ['value1', 'value2&='],
      },
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1?array1[]=value1&array1[]=value2%26%3D`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using arrays as query params with []`
    );

    c = new Curl('http://127.0.0.1', {
      params: {
        array1: ['value1', 'value2&='],
      },
      useBracketsForParams: false,
    });
    expectedCmdline = `curl -D /dev/stderr -q -X GET -L --url http://127.0.0.1?array1=value1&array1=value2%26%3D`;
    cmdline = c.cmdline;
    tester.assertEq(
      cmdline,
      expectedCmdline,
      `cmdline should match when using arrays as query params without []`
    );
  });

  tester.test(
    'curl.Curl (curl failure)',
    async (done) => {
      let c = new Curl('http://0.0.0.0');
      const result = await c.run();
      tester.assert(!result, 'curl should fail');
      tester.assertEq(c.body, undefined, 'Payload should be undefined');
      tester.assert(c.curlFailed, '{curlFailed} should be {true}');
      tester.assertNeq(c.curlError, undefined, '{curlError} should be defined');
      tester.assert(0 != c.curlError.length, '{curlError} should not be empty');

      done();
    },
    {
      isAsync: true,
    }
  );

  tester.test(
    'curl.Curl (GET request)',
    async (done) => {
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        json: true,
        parseJson: true,
      });
      let result = await c.run();
      tester.assert(
        result,
        `when using {"parseJson":true} request should succeed`
      );
      tester.assertEq(
        typeof c.body,
        'object',
        `when using {"parseJson":true} response payload should be an object`
      );

      c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        json: true,
        parseJson: false,
      });
      result = await c.run();
      tester.assert(
        result,
        `when using {"parseJson":false} request should succeed`
      );
      tester.assertEq(
        typeof c.body,
        'string',
        `when using {"parseJson":false} response payload should be a string`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (GET request with query params)',
    async (done) => {
      let params = { userId: 3 };
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        params: params,
        parseJson: true,
      });
      let result = await c.run();
      tester.assert(
        result,
        `when using ${JSON.stringify(
          params
        )} as query params request should succeed`
      );
      tester.assertEq(
        typeof c.body,
        'object',
        `response payload should be an object`
      );
      let resBody = c.body;
      let foundError = false;
      for (let i = 0; i < resBody.length; ++i) {
        if (resBody[i].userId != params.userId) {
          tester.assertEq(
            resBody[i].userId,
            params.userId,
            `entry #${i} should contain {"userId":${params.userId}}`
          );
          foundError = true;
          break;
        }
      }
      if (!foundError) {
        tester.assert(
          true,
          `all entries should contain {"userId":${params.userId}}`
        );
      }

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (POST request)',
    async (done) => {
      let reqBody = {
        title: 'foo',
        body: 'bar',
        userId: 1,
      };
      let c = new Curl('http://jsonplaceholder.typicode.com/posts', {
        method: 'post',
        json: reqBody,
      });
      let result = await c.run();
      tester.assert(result, `request should succeed`);
      tester.assertEq(
        typeof c.body,
        'object',
        `response payload should be an object`
      );
      let resBody = c.body;
      delete resBody.id;
      tester.assertEq(
        resBody,
        reqBody,
        `response payload should be as expected`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (POST request from file)',
    async (done) => {
      const jsonFile = 'data/post_json1.json';
      const reqBody = JSON.parse(std.loadFile(jsonFile));
      let c = new Curl('http://jsonplaceholder.typicode.com/posts', {
        method: 'post',
        jsonFile: jsonFile,
      });
      let result = await c.run();
      tester.assert(result, `request should succeed`);
      tester.assertEq(
        typeof c.body,
        'object',
        `response payload should be an object`
      );
      let resBody = c.body;
      delete resBody.id;
      tester.assertEq(
        resBody,
        reqBody,
        `response payload should be as expected`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (PUT request)',
    async (done) => {
      let reqBody = {
        id: 1,
        title: 'foo',
        body: 'bar2',
        userId: 1,
      };
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        method: 'put',
        json: reqBody,
      });
      let result = await c.run();
      tester.assert(result, `request should succeed`);
      tester.assertEq(
        typeof c.body,
        'object',
        `response payload should be an object`
      );
      let resBody = c.body;
      tester.assertEq(
        resBody,
        reqBody,
        `response payload should be as expected`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (PATCH request)',
    async (done) => {
      let reqBody = {
        body: 'bar2',
      };
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        method: 'patch',
        json: reqBody,
      });
      let result = await c.run();
      tester.assert(result, `request should succeed`);
      tester.assertEq(
        typeof c.body,
        'object',
        `response payload should be an object`
      );
      let resBody = c.body;
      tester.assertEq(
        resBody.body,
        reqBody.body,
        `response payload should contain {"body":"${reqBody.body}"}`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (DELETE request)',
    async (done) => {
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1', {
        method: 'delete',
        json: true,
      });
      let result = await c.run();
      tester.assert(result, `request should succeed`);

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.Curl (GET request failure)',
    async (done) => {
      let c = new Curl('http://jsonplaceholder.typicode.com/posts/1000', {
        failOnHttpError: true,
      });
      let result = await c.run();
      tester.assert(!result, `request should fail`);
      tester.assertEq(c.statusCode, 404, `status code should be 404`);

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.curlRequest (GET request success)',
    async (done) => {
      const resBody = await curlRequest(
        'http://jsonplaceholder.typicode.com/posts/1'
      );
      tester.assertEq(
        typeof resBody,
        'object',
        `response payload should be an object`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.curlRequest (GET request failure)',
    async (done) => {
      let exception;
      try {
        await curlRequest('http://jsonplaceholder.typicode.com/posts/1000', {
          failOnHttpError: true,
        });
      } catch (e) {
        exception = e;
      }
      tester.assert(undefined !== exception, `an exception should be thrown`);
      tester.assertEq(exception.status.code, 404, 'status code should be 404');
      tester.assertEq(exception.body, {}, 'exception.body should be {}');

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.curlRequest (GET request failure with {"ignoreError":true})',
    async (done) => {
      let exception;
      let resBody;
      try {
        resBody = await curlRequest(
          'http://jsonplaceholder.typicode.com/posts/1000',
          { ignoreError: true }
        );
      } catch (e) {
        exception = e;
      }
      tester.assert(undefined === exception, `no exception should be thrown`);
      tester.assertEq(resBody, {}, 'returned payload should be {}');

      done();
    },
    { isAsync: true }
  );

  tester.test(
    'curl.curlRequest (POST request success)',
    async (done) => {
      let reqBody = {
        title: 'foo',
        body: 'bar',
        userId: 1,
      };
      const resBody = await curlRequest(
        'http://jsonplaceholder.typicode.com/posts',
        {
          method: 'post',
          json: reqBody,
        }
      );
      tester.assertEq(
        typeof resBody,
        'object',
        `response payload should be an object`
      );
      delete resBody.id;
      tester.assertEq(
        resBody,
        reqBody,
        `response payload should be as expected`
      );

      done();
    },
    { isAsync: true }
  );

  tester.test('curl.Curl (set-cookie parsing)', () => {
    const c = new Curl('http://127.0.0.1');
    let setCookieValues = [
      {
        description: 'a single cookie',
        cookiesStrings:
          'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4; Max-Age=1800; Path=/; Expires=Tue, 22 Mar 2022 21:51:08 GMT; HttpOnly; Secure; SameSite=Strict',
        expectedCookies: {
          token: {
            name: 'token',
            value:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4',
            maxAge: 1800,
            path: '/',
            expires: new Date('2022-03-22T21:51:08.000Z'),
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        },
      },
      {
        description: 'multiple cookies in separate cookies strings',
        cookiesStrings: [
          'sticky-session=http://10.1.0.1:10000; Path=/',
          'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4; Max-Age=1800; Path=/; Expires=Tue, 22 Mar 2022 21:51:08 GMT; HttpOnly; Secure; SameSite=Strict',
        ],
        expectedCookies: {
          'sticky-session': {
            name: 'sticky-session',
            value: 'http://10.1.0.1:10000',
            path: '/',
          },
          token: {
            name: 'token',
            value:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4',
            maxAge: 1800,
            path: '/',
            expires: new Date('2022-03-22T21:51:08.000Z'),
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        },
      },
      {
        description: 'multiple cookies in the same cookies strings',
        cookiesStrings: [
          'AUTH_SESSION_ID_LEGACY=d637d240-500b-49e3-8691-74b53d98c8f5.ae2d4b6f8713; Version=1; Path=/auth/realms/testing/; Secure; HttpOnly, KEYCLOAK_IDENTITY=; Version=1; Comment=Expiring cookie; Expires=Thu, 01 Jan 1970 00:00:10 GMT; Max-Age=0; Path=/auth/realms/testing/; Secure; HttpOnly, sticky-session=http://10.1.0.1:10000; Path=/, token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4; Max-Age=1800; Path=/; Expires=Tue, 22 Mar 2022 21:51:08 GMT; HttpOnly; Secure; SameSite=Strict',
        ],
        expectedCookies: {
          AUTH_SESSION_ID_LEGACY: {
            name: 'AUTH_SESSION_ID_LEGACY',
            value: 'd637d240-500b-49e3-8691-74b53d98c8f5.ae2d4b6f8713',
            version: '1',
            path: '/auth/realms/testing/',
            secure: true,
            httpOnly: true,
          },
          KEYCLOAK_IDENTITY: {
            name: 'KEYCLOAK_IDENTITY',
            value: '',
            version: '1',
            comment: 'Expiring cookie',
            maxAge: 0,
            path: '/auth/realms/testing/',
            secure: true,
            httpOnly: true,
          },
          'sticky-session': {
            name: 'sticky-session',
            value: 'http://10.1.0.1:10000',
            path: '/',
          },
          token: {
            name: 'token',
            value:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGdtYWlsLmNvbSIsImlhdCI6MTY0Nzk4NDA2OH0.TkImMUNI0QDOYOwtRKXqz5xCHpIdNB-2owYH2tkyxZ4',
            maxAge: 1800,
            path: '/',
            expires: new Date('2022-03-22T21:51:08.000Z'),
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        },
      },
    ];
    for (const e of setCookieValues) {
      const cookies = c._parseSetCookieHeaders(e.cookiesStrings);
      tester.assertEq(
        cookies,
        e.expectedCookies,
        `cookie should match when having ${e.description}`
      );
    }
  });

  tester.test(
    'curl.multiCurl',
    async (done) => {
      const requests = [
        new Curl('http://jsonplaceholder.typicode.com/posts/1'),
        new Curl('http://jsonplaceholder.typicode.com/posts/2'),
        new Curl('http://jsonplaceholder.typicode.com/posts/3'),
      ];
      const data = await multiCurl(requests);
      tester.assertEq(data.length, 3, 'size of results should be 3');
      tester.assertEq(
        data.filter((e) => !e.result).length,
        0,
        'size of failed results should be 0'
      );

      done();
    },
    { isAsync: true }
  );
};
