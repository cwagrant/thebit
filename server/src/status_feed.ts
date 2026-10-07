import type { IncomingMessage, Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";

export const STATUS_FEED_PATH = "/api/events";

const CHECK_INTERVAL_MS = 1000;
const PING_INTERVAL_MS = 30 * 1000;

export interface StatusSnapshot {
  controllers: { [id: number]: ControllerStatus };
  listeners: { [id: number]: ListenerStatus };
  states: { [controllerId: number]: unknown };
}

export function attachStatusFeed(
  server: Server,
  snapshot: () => Promise<StatusSnapshot>,
  authorized: (req: IncomingMessage) => boolean
): void {
  const wss = new WebSocketServer({ noServer: true });
  const alive = new WeakSet<WebSocket>();
  let lastSent: string | undefined;
  let checking = false;

  server.on("upgrade", (req, socket, head) => {
    const path = (req.url || "").split("?")[0];

    if (path !== STATUS_FEED_PATH) {
      socket.destroy();
      return;
    }

    if (!authorized(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (client) => wss.emit("connection", client));
  });

  const current = async (): Promise<string> => JSON.stringify({ type: "statuses", ...await snapshot() });

  wss.on("connection", async (client: WebSocket) => {
    alive.add(client);
    client.on("pong", () => alive.add(client));
    client.on("error", () => { });

    try {
      lastSent = await current();

      if (client.readyState === WebSocket.OPEN)
        client.send(lastSent);
    } catch (err) {
      console.error("Status feed: failed to send statuses to a new client", err);
    }
  });

  setInterval(async () => {
    if (wss.clients.size === 0 || checking)
      return;

    checking = true;

    try {
      const message = await current();

      if (message === lastSent)
        return;

      lastSent = message;

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN)
          client.send(message);
      }
    } catch (err) {
      console.error("Status feed: failed to check statuses", err);
    } finally {
      checking = false;
    }
  }, CHECK_INTERVAL_MS).unref();

  setInterval(() => {
    for (const client of wss.clients) {
      if (!alive.has(client)) {
        client.terminate();
        continue;
      }

      alive.delete(client);
      client.ping();
    }
  }, PING_INTERVAL_MS).unref();
}
