import WebSocket from "ws";

// Shared plumbing for listeners' "test connection" checks (see
// Listener.testConnection): a throwaway WebSocket, separate from whatever
// the running listener has open, that lives just long enough to find out
// whether connecting works.

const TEST_TIMEOUT_MS = 10 * 1000;

type Finish = (result: ToolResult) => void;

interface ProbeHandlers {
  // The socket opened. Call `finish` here if being open is all the test
  // needs to see.
  onOpen?: (socket: WebSocket, finish: Finish) => void;
  // Called for every message, parsed as JSON where it is JSON.
  onMessage?: (message: any, socket: WebSocket, finish: Finish) => void;
}

export function probeWebSocket(url: string, handlers: ProbeHandlers): Promise<ToolResult> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    let finished = false;

    const finish: Finish = (result) => {
      if (finished)
        return;

      finished = true;
      clearTimeout(timer);
      // Keep a listener for the "error" ws emits when a socket is torn down
      // mid-handshake - unheard, it would take the process down.
      socket?.removeAllListeners();
      socket?.on("error", () => { });
      socket?.terminate();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, message: `No answer from ${url.split("?")[0]} within ${TEST_TIMEOUT_MS / 1000} seconds.` });
    }, TEST_TIMEOUT_MS);

    try {
      socket = new WebSocket(url, { handshakeTimeout: TEST_TIMEOUT_MS });
    } catch (err: any) {
      return finish({ ok: false, message: `Couldn't connect: ${err?.message || err}` });
    }

    socket.on("open", () => handlers.onOpen?.(socket, finish));

    socket.on("message", (data: WebSocket.RawData) => {
      let message: any = data.toString();

      try {
        message = JSON.parse(message);
      } catch { }

      handlers.onMessage?.(message, socket, finish);
    });

    socket.on("error", (err: Error) => {
      finish({ ok: false, message: `Couldn't connect: ${err.message || err}` });
    });

    socket.on("close", () => {
      finish({ ok: false, message: "The server closed the connection before the test finished." });
    });
  });
}
