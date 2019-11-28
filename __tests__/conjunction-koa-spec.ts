import * as sseioClient from 'sse.io-client';
import axios from 'axios';
import koa from 'koa';

import * as sseio from '../src/index';
import { EVENTS, PORT, PATH } from './helpers/mock_data';
import { genEventSourceUrl } from './helpers/utils';

const shimoGuid = require('shimo-guid');

function koaApp(): any {
  const app = new koa();
  app.use(async ctx => {
    ctx.body = 'Hello Koa!';
  });
  return app;
}

describe.only('should sse server works normally when In conjunction with Koa', () => {
  beforeAll(done => {
    const server = require('http').createServer(koaApp().callback());
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

  it('should koa app works normally', async () => {
    const res = await axios.get(`http://localhost:${PORT}`);
    expect(res.status).toEqual(200);
    expect(res.data).toEqual('Hello Koa!');
  });

  it('should send sse message works normally', done => {
    const message = 'in conjunction with Koa';
    this.sseServer.on('conn:create', () => {
      this.eventHandler.send(this.guid, message);
    });

    this.client.on('message', data => {
      expect(data.event).toEqual(EVENTS.TEST_NORMAL);
      expect(data.message).toEqual(message);
      done();
    });
  });
});
