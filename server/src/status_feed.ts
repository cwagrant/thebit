import type { IncomingMessage, Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";

// Pushes controller and listener connection statuses to the browser over a
// WebSocket (at STATUS_FEED_PATH), so pages showing them don't each have to
// keep asking.
//
// Statuses are worked out on demand rather than announced when they change
// (see Controller.status / Listener.status), so this checks them on a timer
// and only sends when something is different from last time. Every message
// is the whole picture - it's small, and it means a client never has to
// piece state together from changes it may have missed.

export const STATUS_FEED_PATH = "/api/events";

const CHECK_INTERVAL_MS = 1000;
// Keeps idle connections from being dropped by proxies in between, and
// finds clients that went away without closing.
const PING_INTERVAL_MS = 30 * 1000;

export interface StatusSnapshot {
  controllers: { [id: number]: ControllerStatus };
  listeners: { [id: number]: ListenerStatus };
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
      // A new client gets the current picture straight away, whether or not
      // anything has changed lately.
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
