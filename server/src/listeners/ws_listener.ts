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

  stop(): void {
    this.socket.close();
  }

  parseRules(): void {
    this.rules.forEach((rule) => {
      this.socket.on(rule.message, (args: any) => {
        try {
          const executionResult: ListenerAction | ListenerAction[] = this.execRule(rule, args);
          const listenerActions = Array.isArray(executionResult) ? executionResult : [executionResult];

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
