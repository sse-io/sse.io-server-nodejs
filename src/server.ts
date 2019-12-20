import http, { Server } from 'http';
import { PassThrough } from 'stream';
import url from 'url';
import * as _ from 'lodash';
import { EventEmitter } from 'events';
import _debug from 'debug';

import ClientManager from './clientManager';
import EventHandler from './eventHandler';
import { sseContext, IRegisterOptions } from './types';
import Client from './client';
import { EVENTS } from './constants';

const debug = _debug('sse-io-server');
const matchit = require('matchit');

export type IOptions = {
  path?: string;
};

const DEFAULT_OPTIONS: IOptions = {
  path: '/sseio',
};

export default class SSEServer extends EventEmitter {
  private options: IOptions;
  private urlMatchRes: any[] = [];
  private eventHandlers: Map<string, EventHandler> = new Map<string, EventHandler>();
  private clientManager: ClientManager;

  constructor(options: IOptions) {
    super();
    this.options = _.defaults(options, DEFAULT_OPTIONS);
    this.urlMatchRes.push(matchit.parse(this.options.path));
    this.clientManager = new ClientManager();
  }

  public registerEventHandler(
    event: string,
    options: IRegisterOptions
  ): EventHandler {
    const eventHandler = new EventHandler(
      event,
      this.clientManager,
      {
        getRoomId: options.getRoomId,
        fetch: options.fetch
      }
    );

    this.eventHandlers.set(event, eventHandler);
    return eventHandler;
  }

  public attach(server: Server) {
    const listeners = server.listeners('request').slice(0);
    server.removeAllListeners('request');
    server.on('close', () => {
      this.close();
    });

    server.on('request', (req, res) => {
      const urlObj = url.parse(req.url, true);
      const pathname = urlObj.pathname || '';
      if (this.matchPath(pathname)) {
        this.httpHandler(req, res);
      } else {
        for (let i = 0, l = listeners.length; i < l; i++) {
          listeners[i].call(server, req, res);
        }
      }
    });
  }

  public listen(port: number): Server {
    const server = http.createServer();
    this.attach(server);
    server.listen(port);

    return server;
  }

  private close() {
    this.clientManager.close();
  }

  private httpHandler(req: any, res: any) {
    const urlObj = url.parse(req.url, true);
    const query = urlObj.query;
    const pathname = urlObj.pathname || '';

    if (!query.events || !query.clientId) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: `params 'events' and 'clientId' is required!`,
        })
      );
      return;
    }

    const stream = new PassThrough();
    const clientId = String(query.clientId);
    const client = this.clientManager.newClient(clientId, stream);

    const resClose = () => {
      res.end();
      this.terminateClient(client);
      this.emit(EVENTS.CLOSE_CONNECTION, clientId);
    };
    req.on('close', () => {
      debug(`connection closed by client:${clientId}`);
      resClose();
    });
    req.on('error', (e: any) => {
      resClose();
      this.emit(EVENTS.ERROR, new Error(`client request error:, ${e}`));
    });

    stream.pipe(res, { end: false });
    stream.on('error', e => {
      resClose();
      this.emit(EVENTS.ERROR, new Error(`response stream error:, ${e}`));
    });
    stream.on('end', () => {
      debug(`stream of client:${clientId} end`);
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    this.bindEventHandler(client, query, this.parsePathParams(pathname));
    this.emit(EVENTS.CREATE_CONNECTION, clientId);
    debug(`connection created by client:${clientId}`);
  }

  private bindEventHandler(client: Client, query: any, params: any) {
    let events: any[] = [];
    if (Array.isArray(query.events)) {
      events = query.events;
    } else {
      events[0] = query.events;
    }
    const context: sseContext = {
      query,
      params,
    };

    for (const event of events) {
      const handler = this.eventHandlers.get(event);
      if (handler) {
        if (handler.fetch) {
          client.fetching = true;
          const promise = new Promise(async (resolve, reject) => {
            try {
              // @ts-ignore
              const message = await handler.fetch(context);
              if (message) {
                let payload = message;
                if (!(message instanceof String)) {
                  payload = JSON.stringify(message);
                }
                await client.sendEventMessage(event, payload, true);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
            await client.handleDelayMessage();
          });
          promise.then().catch(err => {
            this.emit(
              EVENTS.ERROR,
              new Error(`'fetch' func throws an error: ${err}`)
            );
          });
        }

        let roomId = handler.getRoomId(context);
        roomId = String(roomId);
        handler.addClientToRoom(client.getId(), roomId);
        client.addRoom(event, roomId);
      }
    }
  }

  private terminateClient(client: Client): void {
    const rooms = client.getRooms();
    for (const room of rooms) {
      const event = room.event;
      const handler = this.eventHandlers.get(event);
      if (handler) {
        handler.removeClientFromRoom(client.getId(), room.roomId);
      }
    }
    this.clientManager.destroyClient(client.getId());
  }

  private matchPath(path: string): boolean {
    const res = matchit.match(path, this.urlMatchRes);
    return res.length > 0;
  }

  private parsePathParams(path: string): Object {
    return matchit.exec(path, this.urlMatchRes[0]);
  }
}
