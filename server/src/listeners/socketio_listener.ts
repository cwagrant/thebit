import { io } from "socket.io-client";
import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";

class SocketIOListener extends Listener {
  private _socket: any;

  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  start(): void {
    if (!this.active)
      return;

    const { address, options } = this.options;
    this._socket = io(address, options);

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
          const listenerActions = Array.isArray(executionResult) ? executionResult : [executionResult];

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
