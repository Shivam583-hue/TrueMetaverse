import type { IncomingMessage, OutgoingMessage } from "@repo/types";

const WS_URL = `ws://${location.hostname}:3001`;

export type Handlers = {
  [K in OutgoingMessage["type"]]?: (
    payload: Extract<OutgoingMessage, { type: K }>["payload"],
  ) => void;
};

export class ArenaSocket {
  private ws: WebSocket;
  private queue: IncomingMessage[] = [];
  private open = false;

  constructor(
    private handlers: Handlers,
    onClose?: () => void,
  ) {
    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = () => {
      this.open = true;
      for (const msg of this.queue) this.ws.send(JSON.stringify(msg));
      this.queue = [];
    };
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as OutgoingMessage;
      const handler = this.handlers[message.type];
      (handler as ((p: unknown) => void) | undefined)?.(message.payload);
    };
    this.ws.onclose = () => {
      this.open = false;
      onClose?.();
    };
  }

  private send(message: IncomingMessage) {
    if (this.open) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.queue.push(message);
    }
  }

  join(spaceId: string, token: string) {
    this.send({ type: "join", payload: { spaceId, token } });
  }

  move(x: number, y: number) {
    this.send({ type: "move", payload: { x, y } });
  }

  close() {
    this.ws.onclose = null;
    this.ws.close();
  }
}
