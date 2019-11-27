import { PassThrough } from 'stream';
import _debug from 'debug';

const debug = _debug('sse-io-server');
const PING_DATA = ':\n:\n:\n\n';

export default class Client {
  public stream: PassThrough;
  public fetching: boolean = false;

  private id: string;
  private dying: boolean = false;
  private heartbeatTimer: any;
  private rooms: any[] = [];
  private messageQueue: string[] = [];

  constructor(stream: PassThrough, id: string) {
    this.stream = stream;
    this.id = id;
    this.startHeartbeat();
  }

  public getId(): string {
    return this.id;
  }

  public addRoom(event: string, roomId: string): void {
    this.rooms.push({ event, roomId });
  }

  public getRooms(): any[] {
    return this.rooms;
  }

  public isDying(): boolean {
    return this.dying;
  }

  public close(): void {
    if (!this.dying) {
      this.heartbeatTimer && clearTimeout(this.heartbeatTimer);
      this.stream.end();
      this.dying = true;
    }
  }

  public async sendEventMessage(
    event: string,
    data: string,
    firstFetch: boolean = false
  ) {
    const message = `event: ${event}\ndata: ${data}\n\n`;
    if (this.fetching && !firstFetch) {
      debug(`message:\n'${message}' is being pushed to queue`);
      this.messageQueue.push(message);
      return;
    }

    return this.writeStream(message);
  }

  public async handleDelayMessage() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      // @ts-ignore
      await this.writeStream(message);
    }
    debug(`queue messages have been written to stream`);

    this.fetching = false;
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      await this.writeStream(PING_DATA);
    }, 3000);
  }

  private async writeStream(chunk: string) {
    if (this.dying) {
      return;
    }

    debug(`client:${this.id} write stream message:\n'${chunk}'`);
    return new Promise((resolve, reject) => {
      if (!this.stream.write(chunk)) {
        this.stream.once('drain', resolve);
      } else {
        resolve();
      }
    });
  }
}
