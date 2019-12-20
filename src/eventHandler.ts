import { EventEmitter } from 'events';

import { sseContext, IRegisterOptions } from './types';
import ClientManager from './clientManager';
import { EVENTS } from './constants';

export default class EventHandler extends EventEmitter {
  public getRoomId: (context: sseContext) => string;
  public fetch: ((context: sseContext) => Promise<any>) | undefined;

  private roomClients: Map<string, Set<string>> = new Map<string, Set<string>>();
  private event: string;
  private clientManager: ClientManager;

  constructor(
    event: string,
    clientManager: ClientManager,
    options: IRegisterOptions,
  ) {
    super();
    this.event = event;
    this.getRoomId = options.getRoomId;
    this.clientManager = clientManager;

    if (options.fetch) {
      this.fetch = options.fetch;
    }
  }

  public async send(roomId: string, message: any) {
    const clients = this.getRoomClients(roomId);
    if (!clients) {
      return;
    }

    let payload = message;
    if (!(typeof message === 'string')) {
      payload = JSON.stringify(message);
    }

    const promises: any[] = [];
    for (const id of clients) {
      const client = this.clientManager.getClient(id);
      if (client) {
        promises.push(client.sendEventMessage(this.event, payload));
      }
    }

    await Promise.all(promises);
  }

  public addClientToRoom(id: string, roomId: string) {
    const clients = this.roomClients.get(roomId);
    if (!clients) {
      const v = new Set<string>();
      v.add(id);
      this.roomClients.set(roomId, v);
      this.emit(EVENTS.CREATE_ROOM, roomId);
    } else {
      clients.add(id);
    }
  }

  public removeClientFromRoom(id: string, roomId: string) {
    const clients = this.roomClients.get(roomId);
    if (clients && clients.has(id)) {
      clients.delete(id);
      if (clients.size === 0) {
        this.roomClients.delete(roomId);
        this.emit(EVENTS.ROOM_EMPTY, roomId);
      }
    }
  }

  private getRoomClients(roomId: string): Set<string> | undefined {
    const clients = this.roomClients.get(roomId);
    return clients;
  }
}
