# curl

A wrapper around *curl* binary

## Curl

### Curl.constructor(...)

`new Curl(url, opt)`

Constructor

* **[url]** (*string*} : http:/https url to connect to
* opt (*object*) : options
  * opt.method (*string*) : HTTP method (default = `GET`)
  * opt.userAgent (*string*) : user agent
  * opt.insecure (*boolean*) : if `true` ignore SSL errors (default = `false`)
  * opt.headers (*object*) dictionary of extra headers (ex: `{"x-header":"value"}`)
  * opt.followRedirects (*boolean*) : whether or not HTTP redirects should be followed (default = `true`)
  * opt.maxRedirects (*integer*) : maximum number of HTTP redirects to follow (by default, use curl default)
    * will be ignored if `opt.followRedirects` is `false`
  * opt.outputFile (*string*) : if set, *curl* output will be redirected to this file
  * opt.connectTimeout (*integer*) : maximum number of seconds allowed for connection
  * opt.maxTime (*integer*) : maximum number of seconds allowed for the transfer
  * opt.data (*object*) : data to send as `application/x-www-form-urlencoded`
    * content type will automatically be set to `application/x-www-form-urlencoded`
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
  * opt.json (*object|string|true*) : data to send as `application/json`
    * content type will automatically be set to application/json
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if `opt.data` was set
  * opt.file (*string|object*) : used to upload a file
    * content type will automatically be set to `multipart/form-data`
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if one of (`opt.data`, `opt.json`) was set
    * when using a *string*, `opt.file` should be the path of the file to upload
    * when using an *object*
      * **[opt.file.filepath]** (*string*) : path of the local file (mandatory)
      * opt.file.name (*string*) : name of the form parameter (default = `file`)
      * opt.file.filename (*string*) : name of the file (defaults to the name of the local file)
  * opt.body (*string*) : raw body to send
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if one of (`opt.data`, `opt.json`, `opt.file`) was set
  * opt.params (*object*) : parameters to add as query string
  * opt.normalizeHeaders (*boolean*) : if `true`, header names in response will be converted to lower case (default = `true`)
  * opt.parseJson (*boolean*) : if `true`, automatically parse JSON in responses (default = `true`)
  * opt.failOnHttpError (*boolean*) : if `true`, `run` method will return `false` in case status code is not in `[200, 299]` (default = `false`)
  * opt.basicAuth (*object*) : basic HTTP authentication 
    * opt.basicAuth.username (*string*) : auth username
    * opt.basicAuth.password (*string*) : auth password
  * opt.bearerToken (*string*) : bearer token to use
    * will be ignored if `opt.basicAuth` was set
  * opt.context (*any*) : user define context (can be used to identify curl request later by client code)

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(JSON.stringify(c.body));
```

### Curl.run(...)

`.run()`

Execute the *curl* request

**return** *Promise* which resolves to a *boolean* indicating success or failure

A request will be considered as failed if one of the following happened

* *curl* returned an error (ex: invalid url)
* HTTP status code is not in `[200, 299]` **and** `opt.failOnHttpError` was set to `true`

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
const result = await c.run();
console.log(result);
console.log(JSON.stringify(c.body));
```

### Curl.cancel(...)

`.cancel()`

Cancels *curl* request

**return** *boolean* : `true` if *curl* process was successfully cancelled, `false` otherwise

<u>Example</u>

```js
const c = new Curl(`http://127.0.0.1`);
os.setTimeout(() => {
    c.cancel();
}, 1000);
await c.run();
console.log(c.wasCancelled);
```

### Curl.cmdline

`.cmdline`

Retrieves *curl* command line corresponding to the request. It's likely to be invalid when pasted into a terminal since it will lack shell escaping

**return** *string*

<u>Example</u>

```js
const c = new Curl('https://jsonplaceholder.typicode.com/posts', {
    method:'post',
    json: {
        title: 'foo',
        body: 'bar',
        userId: 1
    }
});
console.log(c.cmdline);
```

Above code will print

```
curl -D /dev/stderr --no-progress-meter -q -X POST -L -H Content-Type: application/json -d {"title":"foo","body":"bar","userId":1} --url https://jsonplaceholder.typicode.com/posts
```

### Curl.didTimeout

`.didTimeout`

Indicates whether or not *curl* request timed out (because of `opt.maxTime`)

**return** *boolean*

<u>Example</u>

```js
const c = new Curl('https://jsonplaceholder.typicode.com/posts/1000', {
    maxTime: 1
});
await c.run();
console.log(c.didTimeout);
```

### Curl.wasCancelled

`.wasCancelled`

Indicates whether or not *curl* request was cancelled (because `Curl.cancel()` method was called)

**return** *boolean*

<u>Example</u>

```js
const c = new Curl(`http://127.0.0.1`);
os.setTimeout(() => {
    c.cancel();
}, 1000);
await c.run();
console.log(c.wasCancelled);
```

### Curl.curlFailed

`.curlFailed`

Indicates whether or not *curl* failed (ex: invalid url)

**return** *boolean*

<u>Example</u>

```js
const c = new Curl('http://0.0.0.0');
await c.run();
console.log(c.curlFailed);
```

### Curl.curlError

`.curlError`

Retrieves *curl* error message

**return** *string*

Property will be `undefined` unless there was a *curl* failure

<u>Example</u>

```js
const c = new Curl('http://0.0.0.0');
await c.run();
console.log(c.curlError);
```

### Curl.httpFailed

`.httpFailed`

Indicates whether or not HTTP request failed (i:e status code not in `[200, 299]`)

**return** *boolean*

<u>Example</u>

```js
// request will return a 404
const c = new Curl('https://jsonplaceholder.typicode.com/posts/1000');
await c.run();
console.log(c.httpFailed);
```

### Curl.failed

`.failed`

Indicates whether or not request failed (*curl* failure or HTTP failure)

**return** *boolean*

If HTTP failed (ie: status code is not in `[200, 299]`) but `opt.failOnHttpError` was set to `false`, property will be `false`

<u>Example</u>

```js
let c;
c = new Curl('http://0.0.0.0');
await c.run();
console.log(c.failed);
c = new Curl('https://jsonplaceholder.typicode.com/posts/1000');
await c.run();
console.log(c.failed);
```

### Curl.method

`.method`

Retrieves the HTTP method used to make the request

**return** *string*

<u>Example</u>

```js
const c = new Curl('https://jsonplaceholder.typicode.com/posts/1');
await c.run();
console.log(c.method);
```

### Curl.url

`.url`

Retrieves the HTTP url used to make the request

**return** *string*

<u>Example</u>

```js
const c = new Curl('https://jsonplaceholder.typicode.com/posts/1');
await c.run();
console.log(c.url);
```

### Curl.body

`.body`

Retrieve the response body

**return** *object|string*

In case content-type of response is `application/json` and `opt.parseJson` was set to `true`, library will try to parse body and return an *object*.
In case parsing fails, raw body will be returned as *string*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(JSON.stringify(c.body));
```

### Curl.contentType

`.contentType`

Retrieve content-type of response

**return** *string*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(c.contentType);
```

### Curl.headers

`.headers`

Retrieves response's headers

**return** *object*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(JSON.stringify(c.headers));
```

### Curl.statusCode

`.statusCode`

Retrieves HTTP status code

**return** *integer*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(c.statusCode);
```

### Curl.status

`.status`

Retrieves HTTP status code and status text

**return** *object* with following properties

* code (*integer*) : HTTP status code
* text (*string*) : HTTP status text

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`);
await c.run();
console.log(JSON.stringify(c.status));
```

### Curl.context

`.context`

Retrieves the context which was passed in constructor

**return** *any*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`, {
    context:{id:1}
});
await c.run();
console.log(JSON.stringify(c.context));
```

### Curl.duration

`.duration`

Retrieves the duration of the request in milliseconds 

**return** *integer*

<u>Example</u>

```js
const c = new Curl(`https://jsonplaceholder.typicode.com/posts/1`, {
    context:{id:1}
});
await c.run();
console.log(c.duration);
```

## curlRequest

`curlRequest(url, opt)`

Perfoms a *curl* request and return the response's body

* **[url]** (*string*} : http:/https url to connect to
* opt (*object*) : options
  * opt.method (*string*) : HTTP method (default = `GET`)
  * opt.userAgent (*string*) : user agent
  * opt.insecure (*boolean*) : if `true` ignore SSL errors (default = `false`)
  * opt.headers (*object*) dictionary of extra headers (ex: `{"x-header":"value"}`)
  * opt.followRedirects (*boolean*) : whether or not HTTP redirects should be followed (default = `true`)
  * opt.maxRedirects (*integer*) : maximum number of HTTP redirects to follow (by default, use curl default)
    * will be ignored if `opt.followRedirects` is `false`
  * opt.outputFile (*string*) : if set, *curl* output will be redirected to this file
  * opt.connectTimeout (*integer*) : maximum number of seconds allowed for connection
  * opt.maxTime (*integer*) : maximum number of seconds allowed for the transfer
  * opt.data (*object*) : data to send as `application/x-www-form-urlencoded`
    * content type will automatically be set to `application/x-www-form-urlencoded`
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
  * opt.json (*object|string|true*) : data to send as `application/json`
    * content type will automatically be set to application/json
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if `opt.data` was set
  * opt.file (*string|object*) : used to upload a file
    * content type will automatically be set to `multipart/form-data`
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if one of (`opt.data`, `opt.json`) was set
    * when using a *string*, `opt.file` should be the path of the file to upload
    * when using an *object*
      * **[opt.file.filepath]** (*string*) : path of the local file (mandatory)
      * opt.file.name (*string*) : name of the form parameter (default = `file`)
      * opt.file.filename (*string*) : name of the file (defaults to the name of the local file)
  * opt.body (*string*) : raw body to send
    * will be ignored unless `opt.method` is one of `["PUT", "POST", "DELETE", "PATCH"]`
    * will be ignored if one of (`opt.data`, `opt.json`, `opt.file`) was set
  * opt.params (*object*) : parameters to add as query string
  * opt.normalizeHeaders (*boolean*) : if `true`, header names in response will be converted to lower case (default = `true`)
  * opt.parseJson (*boolean*) : if `true`, automatically parse JSON in responses (default = `true`)
  * opt.failOnHttpError (*boolean*) : if `true`, `run` method will return `false` in case status code is not in `[200, 299]` (default = `false`)
  * opt.basicAuth (*object*) : basic HTTP authentication 
    * opt.basicAuth.username (*string*) : auth username
    * opt.basicAuth.password (*string*) : auth password
  * opt.bearerToken (*string*) : bearer token to use
    * will be ignored if `opt.basicAuth` was set
  * opt.context (*any*) : user define context (can be used to identify curl request later by client code)
  * opt.ignoreError (*boolean*):  if `true` promise will resolve to the response's body even if curl failed or HTTP failed

**return** *Promise* which resolves to the response's body

In case request failed, an exception will be triggered, using either the *curl* error or the response's body as message

Following extra properties will be added to the exception

* status *object|undefined* as returned by `Curl.status` property
* body *string|object|undefined* as returned by `Curl.body` property
* context *any* as returned by `Curl.context` property

<u>Example</u>

```js
const body = await curlRequest('https://jsonplaceholder.typicode.com/posts', {
    method:'post',
    json: {
        title: 'foo',
        body: 'bar',
        userId: 1
    }
});
console.log(JSON.stringify(body, null, 4));
```

## multiCurl

`multiCurl(list)`

Run multiple Curl objects and return when all requests are finished

* **[list]** *Curl[]* : array of `Curl` *objects*

**return** *Promise* which resolved to an *object[]* where each *object* has following properties

* result (*boolean*) : whether or not request failed (same as the result of `Process.run()`)
* curl (*Curl*) : `Curl` *object*

<u>Example</u>

```js
const requests = [];
for (let i = 1; i < 3; ++i) {
    requests.push(new Curl(`https://jsonplaceholder.typicode.com/posts/${i}`));
}
const responses = (await multiCurl(requests)).map((e => e.curl.body));
console.log(JSON.stringify(responses, null, 4));
```