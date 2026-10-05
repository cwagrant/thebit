import { io } from "socket.io-client";
import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";

class SocketIOListener extends Listener {
  private _socket: any;

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  static get fields(): SettingField[] {
    return [
      {
        key: "address",
        label: "Server address",
        type: "text",
        required: true,
        placeholder: "https://example.com"
      },
      {
        key: "token",
        label: "Auth token",
        type: "password",
        secret: true,
        help: "Sent to the server as auth.token, exactly as entered - include a 'Bearer ' prefix if the server expects one."
      },
      {
        key: "options",
        label: "Socket.IO options",
        type: "json",
        help: "Any other options to pass to the Socket.IO client."
      }
    ];
  }

  start(): void {
    if (!this.active)
      return;

    const { address, options } = this.options;
    const token = this.secret("token");

    this._socket = io(address, token ? { ...options, auth: { ...options?.auth, token } } : options);

    this.socket.on("connect", () => {
      console.log("Connected to Socket IO Server: ", this.name);
    });
    this.socket.on("connect_error", (err: any) => {
      console.log("Connect error", err);
    });
    this.socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO Server: ", this.name);
    });
    this.socket.on("error", (err: any) => {
      console.log("Error from Socket.IO Server: ", this.name);
      console.error(err);
    });

    this.loadRules();
  }

  get status(): ListenerStatus {
    if (!this.active)
      return { state: "disabled" };

    if (this._socket?.connected)
      return { state: "connected" };

    // socket.io-client keeps retrying on its own while `active` is true.
    return { state: this._socket?.active ? "connecting" : "disconnected" };
  }

  stop(): void {
    console.log('Stopping SocketIOListener', this.name);
    this._socket.disconnect();
  }

  get socket() {
    return this._socket;
  }

  parseRules(): void {
    this.rules.forEach((rule) => {
      this.socket.on(rule.message, (args: any) => {
        try {
          const executionResult: ListenerAction | ListenerAction[] = this.execRule(rule, args);
          const listenerActions = (Array.isArray(executionResult) ? executionResult : [executionResult]).filter(Boolean);

          this.callActions(listenerActions);
        } catch (err: any) {
          console.error('Error executing rule', rule.id, err);
        }
      });
    });
  }
}

export default SocketIOListener;
export { SocketIOListener };
