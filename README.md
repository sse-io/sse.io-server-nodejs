# SSE-IO

NodeJS server for SSE-IO. 

## How to use

```js
const sseio = require('sse.io-server-nodejs')
```

Import using ES6
```js
import * as sseio from 'sse.io-server-nodejs';
```

The following example attaches sse.io to a plain Node.JS HTTP server listening on port 3000.
```js
const server = http.createServer();
const sseServer = sseio.newServer(server, { path: '/user/:userId/foo' });

const eventHandler = sseServer.registerEventHandler('event', {
  getRoomId: (context): string => {
    return context.params.guid;
  },
});

server.listen(3000);

eventHandler.send('roomId', 'message');
```

### Standalone

```js
const sseServer = sseio.newServer({ path: '/user/:userId/foo' });

// ... regist event handler

sseServer.listen(3000);
```

### In conjunction with Koa

```js
const app = new require('koa')();
const server = require('http').createServer(app.callback());

const sseServer = sseio.newServer(server, {
  path: '/files/:fileGuid/pull'
})

// ... regist event handler

server.listen(3000);
```

### In conjunction with Express

```js
const app = require('express')();
const server = require('http').createServer(app);

const sseServer = sseio.newServer(server, {
  path: '/files/:fileGuid/pull'
})

// ... regist event handler

server.listen(3000);
```

## API

### SSEIO

#### newServer(httpServer, options)

 - `httpServer` _[http.Server](https://nodejs.org/docs/latest-v10.x/api/http.html#http_class_http_server)_ The server to bind to.
 - `options` _(Object)_
   - `path` _(String)_ The url path. You can add path params as well like `/users/:userId`.
 - **Returns** `Server`
 
#### newServer(options)

 - `options` _(Object)_ See above for available options.
 - **Returns** `Server`

Usually using for standalone mode.

### Server

#### server.registerEventHandler(event, options)

 - `event` _(String)_ The event you want to handle.
 - `options` _(Object)_
   - `getRoomId` _(Function)_ `(context: sseContext) => string` Return the room ID. 
   - `fetch` _(Function, Optional)_ `(context: sseContext) => Promise<any>` It will be executed once after a client is connected, and send the result to the client
 - **Returns** `EventHandler`

#### server.listen(port)

 - `port` _(Number)_ the port to listen on
 - **Returns** _[http.Server](https://nodejs.org/docs/latest-v10.x/api/http.html#http_class_http_server)_

Starts the HTTP server listening for connections, usually using for standalone mode.

#### server.on(event, callback)

Register a handler for the event. **The 'error' event must be handled.**

**Event: 'conn:create'**

 - `callback` _(Function)_ The `clientId` will be passed to the callback function

Fired when a new connection is established.

```
sseServer.on('conn:create', clientId => {
  console.log(clientId);
})
```

**Event: 'conn:close'**

 - `callback` _(Function)_ The `clientId` will be passed to the callback function

Fired when a connection is closed.

**Event: 'error'**

 - `callback` _(Function)_ an Error will be passed to the callback function

Fired when an error occurs.

```
sseServer.on('error', err => {
  console.error(err);
})
```

#### Type: sseContext

It's an object containing `params` and `query` keys.

 - `params` The path params parse from url
 - `query` The query params parse from url

### EventHandler

#### eventHandler.send(roomId, message)

 - `roomId` _(String)_ Room id
 - `message` _(any)_ Message be to send. It can be any type. If it's not a string, then it will be stringify by `JSON.stringify()`.

Send a message to the **clients in room**.

#### eventHandler.on(event, callback)

Register a handler for the event.

**Event: 'room:create'**

 - `callback` _(Function)_ The `roomId` will be passed to the callback function

Fired when a room is created.

```
eventHandler.on('room:create', roomId => {
  console.log('a room:', roomId, 'has been created');
})
```

**Event: 'room:empty'**

 - `callback` _(Function)_ The `roomId` will be passed to the callback function

Fired when a room is empty.
