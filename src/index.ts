import { Server } from 'http';
import { IRegisterOptions } from './types';
import SSEServer, { IOptions } from './server';

export function newServer(
  server: Server | IOptions,
  options?: IOptions
): SSEServer {
  if (server instanceof Server) {
    const sseServer = new SSEServer(options || {});
    sseServer.attach(server);
    return sseServer;
  }

  return new SSEServer(server);
}

export { IOptions, IRegisterOptions };
