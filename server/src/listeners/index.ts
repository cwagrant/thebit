import { SocketIOListener } from "./socketio_listener.js";
import { WSListener } from "./ws_listener.js";

class Listeners {
  private _configs: ListenerConfig[];
  private _listeners: Map<string, any> = new Map();

  constructor(configs: ListenerConfig[]) {
    console.log('Listener Configs', configs)
    this._configs = configs;
  }

  get configs(): ListenerConfig[] {
    return this._configs;
  }

  get listeners(): Map<string, any> {
    return this._listeners;
  }

  // TODO need to look at validating that a listener is setup for the controller
  // type indicated in listeners.yaml
  setupListeners(controller: IController): void {
    this.configs.forEach((cfg: ListenerConfig) => {
      if (cfg.listener == "socketio") {
        const listener = new SocketIOListener(cfg);
        listener.parseRules(controller);
        console.log('createdListener', listener)
        this._listeners.set(listener.name, listener);
      } else if (cfg.listener == "ws") {
        const listener = new WSListener(cfg);
        listener.parseRules(controller);
        console.log('createdListener', listener);
        this._listeners.set(listener.name, listener);
      }
    })
  }
}

export { Listeners, SocketIOListener }
