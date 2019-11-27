import http from 'http';
import * as sseioClient from 'sse.io-client';
import axios from 'axios';

import * as sseio from '../src/index';
import { EVENTS, PORT, PATH } from './helpers/mock_data';
import { genEventSourceUrl } from './helpers/utils';

const shimoGuid = require('shimo-guid');
const bluebird = require('bluebird');

describe('should server works normally when attach sse.io to a plain NodeJS HTTP server', () => {
  describe('can http server also handle requests expect for sse', () => {
    beforeAll(done => {
      const server = http.createServer((req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
        });
        res.end(
          JSON.stringify({
            message: 'ok',
          })
        );
      });

      const sseServer = sseio.newServer(server, { path: PATH });
      this.eventHandler = sseServer.registerEventHandler(EVENTS.TEST_NORMAL, {
        getRoomId: (context): string => {
          return context.params.guid;
        },
      });
      server.listen(PORT, done);
      this.server = server;
      this.sseServer = sseServer;
    });

    it('should server return "ok"', async () => {
      const res = await axios.get(`http://localhost:${PORT}/test`);
      expect(res.status).toEqual(200);
      expect(res.data.message).toEqual('ok');
    });

    afterAll(done => {
      this.server.close(done);
    });
  });

  describe('single event with no fetch func', () => {
    beforeAll(done => {
      const server = http.createServer();
      const sseServer = sseio.newServer(server, { path: PATH });
      this.eventHandler = sseServer.registerEventHandler(EVENTS.TEST_NORMAL, {
        getRoomId: (context): string => {
          return context.params.guid;
        },
      });
      server.listen(PORT, done);
      this.server = server;
      this.sseServer = sseServer;
    });

    afterAll(done => {
      this.server.close(done);
    });

    describe('single client', () => {
      beforeEach(() => {
        this.guid = shimoGuid.new();
        this.client = sseioClient.client(genEventSourceUrl(this.guid), [
          EVENTS.TEST_NORMAL,
        ]);
        this.client.start();
      });

      afterEach(() => {
        this.client.stop();
      });

      it('should send event message correctly using any message type', done => {
        const messages = [
          'hello',
          {
            hello: 'world',
          },
          ['a', 'b'],
        ];
        const expectMessages = [
          'hello',
          JSON.stringify({
            hello: 'world',
          }),
          JSON.stringify(['a', 'b']),
        ];
        this.sseServer.on('conn:create', () => {
          for (const msg of messages) {
            this.eventHandler.send(this.guid, msg);
          }
        });

        let index = 0;
        this.client.on('message', data => {
          expect(data.event).toEqual(EVENTS.TEST_NORMAL);
          expect(data.message).toEqual(expectMessages[index]);
          index++;

          if (index === messages.length) {
            done();
          }
        });
      });

      it('should delete client and close the stream when connection closed by client', done => {
        this.client.stop();
        this.sseServer.on('conn:close', () => {
          done();
        });
      });
    });

    describe('mutiple client', () => {
      beforeAll(() => {
        this.guid1 = shimoGuid.new();
        this.guid2 = shimoGuid.new();
        this.c1a = sseioClient.client(genEventSourceUrl(this.guid1), [
          EVENTS.TEST_NORMAL,
        ]);
        this.c1a.start();
        this.c2a = sseioClient.client(genEventSourceUrl(this.guid1), [
          EVENTS.TEST_NORMAL,
        ]);
        this.c2a.start();
      });

      afterAll(() => {
        this.c1a.stop();
        this.c2a.stop();
      });

      it('should send to mutiple client', done => {
        const msg = 'hello';
        let index = 0;
        this.sseServer.on('conn:create', () => {
          if (++index === 2) {
            this.eventHandler.send(this.guid1, msg);
            this.eventHandler.send(this.guid2, msg);
          }
        });

        const promise1 = new Promise((resolve, reject) => {
          this.c1a.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(msg);
            resolve();
          });
        });
        const promise2 = new Promise((resolve, reject) => {
          this.c2a.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(msg);
            resolve();
          });
        });
        promise1.then(() => promise2).then(done);
      });

      it('should send to message to same room', done => {
        this.c1b = sseioClient.client(genEventSourceUrl(this.guid1), [
          EVENTS.TEST_NORMAL,
        ]);
        this.c1b.start();

        const msg = 'hello';
        this.sseServer.on('conn:create', () => {
          this.eventHandler.send(this.guid1, msg);
        });

        const promise1 = new Promise((resolve, reject) => {
          this.c1a.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(msg);
            resolve();
          });
        });
        const promise2 = new Promise((resolve, reject) => {
          this.c1b.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(msg);
            resolve();
          });
        });
        promise1
          .then(() => promise2)
          .then(() => {
            this.c1b.stop();
            done();
          });
      });
    });
  });

  describe('single event with fetch func', () => {
    const fetchData = ['a', 'b'];
    const mockFetchDelay = 500;

    beforeAll(done => {
      const server = http.createServer();
      const sseServer = sseio.newServer(server, { path: PATH });
      this.eventHandler = sseServer.registerEventHandler(EVENTS.TEST_NORMAL, {
        getRoomId: (context): string => {
          return context.params.guid;
        },
        fetch: async (context): Promise<any> => {
          await bluebird.delay(mockFetchDelay);
          return fetchData;
        },
      });
      server.listen(PORT, done);
      this.server = server;
      this.sseServer = sseServer;
    });

    afterAll(done => {
      this.server.close(done);
    });

    beforeEach(() => {
      this.guid = shimoGuid.new();
      this.client = sseioClient.client(genEventSourceUrl(this.guid), [
        EVENTS.TEST_NORMAL,
      ]);
      this.client.start();
    });

    afterEach(() => {
      this.client.stop();
    });

    describe('fetch func return data', () => {
      it('should return fetch data once connection create', done => {
        this.client.on('message', data => {
          expect(data.event).toEqual(EVENTS.TEST_NORMAL);
          expect(data.message).toEqual(JSON.stringify(fetchData));
          done();
        });
      });

      it('should delay other messages before fetch is done', done => {
        let index = 0;
        let sendTime;
        const messages = ['hello', 'world'];
        const clientId = this.client.getId();
        this.client.on('message', data => {
          if (index === 0) {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(JSON.stringify(fetchData));
          }
          if (index === 2) {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(messages[index - 1]);
            expect(new Date().getTime() - sendTime > mockFetchDelay).toEqual(
              true
            );
            done();
          }

          index++;
        });

        this.sseServer.on('conn:create', id => {
          if (id === clientId) {
            sendTime = new Date().getTime();
            this.eventHandler.send(this.guid, messages[0]);
            this.eventHandler.send(this.guid, messages[1]);
          }
        });
      });

      it('should send messages Immediately after fetch is done', done => {
        let index = 0;
        let sendTime;
        const message = 'hello, world';
        const clientId = this.client.getId();
        this.client.on('message', data => {
          if (index === 0) {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(JSON.stringify(fetchData));
          }
          if (index === 1) {
            expect(data.event).toEqual(EVENTS.TEST_NORMAL);
            expect(data.message).toEqual(message);
            expect(new Date().getTime() - sendTime < 100).toEqual(true);
            done();
          }

          index++;
        });

        this.sseServer.on('conn:create', id => {
          if (clientId === id) {
            setTimeout(() => {
              sendTime = new Date().getTime();
              this.eventHandler.send(this.guid, message);
            }, mockFetchDelay + 100);
          }
        });
      });
    });

    describe('fetch func throw an error', () => {
      beforeAll(() => {
        this.eventHandler = this.sseServer.registerEventHandler(
          EVENTS.TEST_NORMAL,
          {
            getRoomId: (context): string => {
              return context.params.guid;
            },
            fetch: async (context): Promise<any> => {
              throw new Error('foo');
            },
          }
        );
        this.sseServer.on('error', err => {});
      });

      it('sseServer should emit an error event', done => {
        this.sseServer.on('error', err => {
          expect(err.message).toContain('foo');
          done();
        });
        this.client.restart();
      });

      it('should send data normally', done => {
        const msg = 'foooooooo';
        this.client.on('message', data => {
          expect(data.event).toEqual(EVENTS.TEST_NORMAL);
          expect(data.message).toEqual(msg);
          done();
        });
        this.sseServer.on('conn:create', () => {
          this.eventHandler.send(this.guid, msg);
        });
        this.client.restart();
      });
    });
  });

  describe('mutiple events', () => {
    beforeAll(done => {
      const server = http.createServer();
      const sseServer = sseio.newServer(server, { path: PATH });
      this.eventHandler1 = sseServer.registerEventHandler(
        EVENTS.TEST_MULTIPLE_1,
        {
          getRoomId: (context): string => {
            return context.params.guid;
          },
        }
      );
      this.eventHandler2 = sseServer.registerEventHandler(
        EVENTS.TEST_MULTIPLE_2,
        {
          getRoomId: (context): string => {
            return context.params.guid;
          },
        }
      );
      server.listen(PORT, done);
      this.server = server;
      this.sseServer = sseServer;
    });

    afterAll(done => {
      this.server.close(done);
    });

    describe('2 clients with 2 events', () => {
      beforeEach(() => {
        this.guid = shimoGuid.new();
        this.client1 = sseioClient.client(genEventSourceUrl(this.guid), [
          EVENTS.TEST_MULTIPLE_1,
        ]);
        this.client1.start();
        this.client2 = sseioClient.client(genEventSourceUrl(this.guid), [
          EVENTS.TEST_MULTIPLE_2,
        ]);
        this.client2.start();
      });

      afterEach(() => {
        this.client1.stop();
        this.client2.stop();
      });

      it('should send messages for mutiple events', done => {
        const msg1 = 'hello';
        const msg2 = 'world';

        // wait for 2 clients create connection
        let index = 0;
        this.sseServer.on('conn:create', () => {
          if (++index === 2) {
            this.eventHandler1.send(this.guid, msg1);
            this.eventHandler2.send(this.guid, msg2);
          }
        });

        const promise1 = new Promise((resolve, reject) => {
          this.client1.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_MULTIPLE_1);
            expect(data.message).toEqual(msg1);
            resolve();
          });
        });
        const promise2 = new Promise((resolve, reject) => {
          this.client2.on('message', data => {
            expect(data.event).toEqual(EVENTS.TEST_MULTIPLE_2);
            expect(data.message).toEqual(msg2);
            resolve();
          });
        });
        promise1.then(() => promise2).then(done);
      });
    });

    describe('1 clients with 2 events', () => {
      beforeEach(() => {
        this.guid = shimoGuid.new();
        this.client = sseioClient.client(genEventSourceUrl(this.guid), [
          EVENTS.TEST_MULTIPLE_1,
          EVENTS.TEST_MULTIPLE_2,
        ]);
        this.client.start();
      });

      afterEach(() => {
        this.client.stop();
      });

      it('should send messages for mutiple events', done => {
        const msg1 = 'hello';
        const msg2 = 'world';

        // wait for 2 clients create connection
        this.sseServer.on('conn:create', () => {
          this.eventHandler1.send(this.guid, msg1);
          this.eventHandler2.send(this.guid, msg2);
        });

        let index = 0;
        this.client.on('message', data => {
          if (index === 0) {
            expect(data.event).toEqual(EVENTS.TEST_MULTIPLE_1);
            expect(data.message).toEqual(msg1);
          }
          if (index === 1) {
            expect(data.event).toEqual(EVENTS.TEST_MULTIPLE_2);
            expect(data.message).toEqual(msg2);
            done();
          }

          index++;
        });
      });
    });
  });
});
