import { PassThrough } from 'stream';

import Client from './client';

export default class ClientManager {
  private clients: Map<string, Client> = new Map<string, Client>();

  constructor() {}

  public getClient(id: string): Client | undefined {
    return this.clients.get(id);
  }

  public newClient(id: string, stream: PassThrough): Client {
    const client = this.clients.get(id);
    if (client) {
      client.close();
    }

    const newClient = new Client(stream, id);
    this.clients.set(id, newClient);
    return newClient;
  }

  public destroyClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      client.close();
      this.clients.delete(id);
    }
  }

  public close() {
    for (const [, client] of this.clients) {
      client.close();
    }
  }
}
