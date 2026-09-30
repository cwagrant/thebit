import { Controller } from './controllers/index.js';
import { Listener } from './listeners/index.js';
import db from "./db.js";
import knex from "./knex.js";
import cfg from "./config.js";

interface ListenerConstructor {
  new(matrix: Matrix, config: IListener): Listener
}

interface ControllerConstructor {
  new(config: IController): Controller
}

export default class Matrix {
  _controllers: Map<string, Controller> = new Map();
  _listeners: Map<string, Listener> = new Map();
  _available_listeners: Map<string, ListenerConstructor> = new Map();
  // Why an enabled listener failed to start, by listener id - so the
  // listeners page can say more than just "not running".
  _listener_errors: Map<number, string> = new Map();
  _available_controllers: Map<string, ControllerConstructor> = new Map();

  get listeners() { return this._listeners; }
  get controllers() { return this._controllers; }
  get availableListeners() { return this._available_listeners; }
  get listenerErrors() { return this._listener_errors; }
  get availableControllers() { return this._available_controllers; }

  async start() {
    await this.loadControllerPlugins();
    await this.loadListenerPlugins();

    this.loadControllers();
    this.loadListeners();
  }

  // Fully recreates the listener from its current DB row rather than
  // restarting the existing instance in place, for the same reason as
  // reloadController below. Disabled (active=0) rows are stopped and left
  // uninstantiated rather than immediately reconstructed - a disabled
  // listener should not hold a live connection or attempt to reconnect.
  async reloadListener(id: number): Promise<Listener | undefined> {
    const listener = this.listeners.values().find((listener) => listener.id === id);

    if (listener) {
      try {
        listener.stop();
      } catch (err) {
        console.error('Error stopping listener', listener.name, err);
      }

      this.listeners.delete(listener.name);
    }

    const row = await knex("listeners").where('id', id).first();

    if (!row) {
      throw new Error(`Listener ${id} not found`);
    }

    if (!row.active) {
      return undefined;
    }

    row.options = JSON.parse(row.options);

    this._listener_errors.delete(id);

    let newListener: Listener;

    try {
      newListener = this.createListener(row);
    } catch (err: any) {
      this._listener_errors.set(id, err?.message || String(err));
      throw err;
    }

    this.listeners.set(newListener.name, newListener);

    return newListener;
  }

  // Like reloadListener above, fully recreates from the current DB row
  // rather than restarting the existing instance in place, since a
  // controller's options (e.g. an OBS address/password) are read once in
  // its constructor. Controllers don't yet have an enable/disable concept,
  // so unlike reloadListener this always (re)constructs.
  async reloadController(id: number): Promise<Controller> {
    const controller = this.controllers.values().find((controller) => controller.id === id);

    if (controller) {
      try {
        controller.stop();
      } catch (err) {
        console.error('Error stopping controller', controller.name, err);
      }

      this.controllers.delete(controller.name);
    }

    const row = await knex("controllers").where('id', id).first();

    if (!row) {
      throw new Error(`Controller ${id} not found`);
    }

    row.options = JSON.parse(row.options);

    const newController = this.createController(row);
    this.controllers.set(newController.name, newController);

    return newController;
  }

  async loadControllerPlugins(): Promise<void> {
    const promises = Object.entries(cfg.controllerPlugins).map(async ([name, plugin]) => {
      console.log(name, plugin);
      plugin = plugin as string;

      const mod = await import(plugin);
      if (!mod)
        return Promise.reject();

      const plug = mod.default;
      this._available_controllers.set(name, plug);

      return Promise.resolve();
    });

    await Promise.all(promises);

  }

  async loadListenerPlugins(): Promise<void> {
    const promises = Object.entries(cfg.listenerPlugins).map(async ([name, plugin]) => {
      plugin = plugin as string;

      const mod = await import(plugin);
      if (!mod)
        return Promise.reject();

      const plug = mod.default;
      this._available_listeners.set(name, plug);

      return Promise.resolve();
    });

    await Promise.all(promises);

    return Promise.resolve();
  }

  getController(name: string): Controller | undefined {
    return this.controllers.get(name);
  }

  createListener(config: IListener): Listener {
    const listenerClass = this._available_listeners.get(config.kind);

    if (listenerClass)
      return new listenerClass(this, config);

    throw new Error(`Unsupported listener kind: ${config.kind}`);
  }

  createController(config: IController): Controller {
    const controllerClass = this._available_controllers.get(config.kind);

    if (controllerClass)
      return new controllerClass(config);

    console.debug('controllerClass', this._available_controllers, config, controllerClass);

    throw new Error(`Unsupported controller kind: ${config.kind}`);
  }

  loadControllers(): void {
    const rows = db.prepare("SELECT * FROM controllers").all() as IController[];

    rows.forEach((row) => {
      row.options = JSON.parse(row.options);
      try {
        this.controllers.set(
          row.name,
          this.createController(row)
        );
      } catch (err) {
        console.error('Error loading controller', row.name, err);
      }
    });
  }

  loadListeners(): void {
    const rows = db.prepare("SELECT * FROM listeners").all() as IListener[];

    rows.forEach((row) => {
      if (!row.active) {
        return;
      }

      row.options = JSON.parse(row.options);
      try {
        this._listeners.set(
          row.name,
          this.createListener(row)
        );
      } catch (err: any) {
        this._listener_errors.set(row.id, err?.message || String(err));
        console.error('Error loading listener', row.name, err);
      }
    });
  }

  loadListener(props: { id: number, name: string }): void {
    if (!props.id && !props.name)
      throw new Error("loadListener requires either 'id' or 'name' property.");

    knex("listeners").where(props)
      .select("*")
      .limit(1)
      .then((rows: IListener[]) => {
        if (rows.length <= 0)
          throw new Error("Listener not found.");
        else {
          const row = rows[0];
          const listener = this.createListener(row);
          this._listeners.set(listener.name, listener);
        }
      });
  }
}
