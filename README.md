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

## API
