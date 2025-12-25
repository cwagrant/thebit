import { SocketIOListener } from "./socketio_listener.js";
import { readFileSync } from "node:fs";
import path from "path";
import { parse } from "yaml";


class Listeners {
  private _configs: ListenerConfig[];
  private _listeners: Map<string, any> = new Map();

  constructor() {
    const listenerFile = path.join(process.cwd(), "..", "listeners.yaml");
    const data = readFileSync(listenerFile);

    if (data) {
      const parsed = parse(data.toString());
      console.log('Listener Configs', parsed)
      this._configs = parsed.listeners;
    } else {
      this._configs = [] as any;
      console.error("Failed to read listeners.yaml");
    }
  }

  get configs(): ListenerConfig[] {
    return this._configs;
  }

  get listeners(): Map<string, any> {
    return this._listeners;
  }

  setupListeners(controller: IController): void {
    this.configs.forEach((cfg: ListenerConfig) => {
      if (cfg.listener == "socketio") {
        const listener = new SocketIOListener(cfg);
        listener.parseRules(controller);
        console.log('createdListener', listener)
        this._listeners.set(listener.name, listener);
      }
    })
  }
}

export { Listeners, SocketIOListener }
