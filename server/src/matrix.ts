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
  _available_controllers: Map<string, ControllerConstructor> = new Map();

  get listeners() { return this._listeners; }
  get controllers() { return this._controllers; }
  get availableListeners() { return this._available_listeners; }
  get availableControllers() { return this._available_controllers; }

  async start() {
    await this.loadControllerPlugins();
    await this.loadListenerPlugins();

    this.loadControllers();
    this.loadListeners();
  }

  stopListener(id: number): void {
    const listener = this.listeners.values().find((listener) => listener.id === id);

    if (listener) {
      listener.stop();
    }
  }

  startListener(id: number): void {
    const listener = this.listeners.values().find((listener) => listener.id === id);

    if (listener) {
      listener.start();
    }
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
      row.options = JSON.parse(row.options);
      try {
        this._listeners.set(
          row.name,
          this.createListener(row)
        );
      } catch (err) {
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
