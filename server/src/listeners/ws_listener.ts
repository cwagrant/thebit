import WebSocket from "ws";
import Client from "../client.js";
import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";

class WSListener extends Listener {
  private _socket!: Client;
  private static kind = "ws";

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.socket = new Client(config.address);
  }

  static get fields(): SettingField[] {
    return [
      {
        key: "address",
        label: "WebSocket URL",
        type: "ws-url",
        required: true,
        placeholder: "ws://localhost:8080"
      }
    ];
  }

  get socket() {
    return this._socket;
  }

  private set socket(value: Client) {
    this._socket = value;
  }

  start(): void {
    if (!this.active)
      return;

    this.socket = new Client(this.options.address);
  }

  get status(): ListenerStatus {
    if (!this.active)
      return { state: "disabled" };

    // Client reconnects on its own after a drop, so anything short of open
    // means it's still trying.
    return { state: this.socket.ws.readyState === WebSocket.OPEN ? "connected" : "connecting" };
  }

  stop(): void {
    this.socket.close();
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

export default WSListener;
export { WSListener };
