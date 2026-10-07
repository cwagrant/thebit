import WebSocket from "ws";

const TEST_TIMEOUT_MS = 10 * 1000;

type Finish = (result: ToolResult) => void;

interface ProbeHandlers {
  onOpen?: (socket: WebSocket, finish: Finish) => void;
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
