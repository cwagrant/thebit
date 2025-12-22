import WebSocket from "ws";

// Basic reinterpretation of Socket.IO functions
export default class Client {
  url: string;
  ws: WebSocket;
  events: Map<string, Array<Function>> = new Map();
  connectionAttempts: number = 1;

  constructor(url: string) {
    console.debug('Client connecting to WebSocket at:', url);
    this.url = url;
    this.ws = new WebSocket(url);

    this.bindConnectionEvents();
    this.bindWebSocketEvents();
  }

  on(eventName: string, callback: Function): void {
    this.events.set(eventName, this.events.get(eventName) || []);
    this.events.get(eventName)?.push(callback);
  }

  off(eventName: string, callback: Function): void {
    this.events.set(eventName, this.events.get(eventName) || []);
    this.events.get(eventName)?.filter((cb) => {
      return cb !== callback;
    })
  }

  emit(eventName: string, data: JSON): boolean {
    try {
      this.ws.send(JSON.stringify({
        event: eventName,
        data: data
      }))
      return true;
    } catch (error) {
      console.error('Client Failure: Failed to send message.')
      console.error(`Event: ${eventName}, Data: ${data}`)
      console.debug(error);
      return false;
    }
  }

  bindWebSocketEvents(): void {
    for (const socket_event of ["open", "close", "error", "message"]) {
      this.ws.addEventListener(socket_event as keyof WebSocketEventMap, (event: any) => {
        const data = JSON.parse(event.data || '{}');
        // console.debug(`Client Received: ${socket_event} - ${JSON.stringify(data)}`);

        const received_event = socket_event == "message"
          ? data?.event
          : socket_event;

        if (this.events.has(received_event)) {
          const handlers = this.events.get(received_event) || []

          for (const handler of handlers) {
            handler(data);
          }
        }
      });
    }
  }

  bindConnectionEvents(): void {
    this.on("close", () => {
      const intervalTime = this.connectionAttempts * 1000
      const reconnectWait = intervalTime > 10000 ? 10000 : intervalTime

      if (this.connectionAttempts === 1) {
        console.debug('Client Connection Closed')
      }

      setTimeout(() => {
        if (this.connectionAttempts < 6) {
          console.debug(`Client Reconnection Attempt ${this.connectionAttempts}`)
        }
        this.connectionAttempts = this.connectionAttempts + 1;
        this.ws = new WebSocket(this.url);
        this.bindWebSocketEvents();
      }, reconnectWait);
    });

    this.on("open", () => {
      this.connectionAttempts = 1;
      console.debug("Client Connection Opened");
    });
  }
}

