import ivm from "isolated-vm";
import db from "../db.js";
import { ListenerRule } from "./listener_rule.js";
import Matrix from "../matrix.js";
import History from "../history.js";
import { saveSecrets } from "../settings.js";

abstract class Listener implements IListener {
  private _matrix: Matrix;
  private _id: number;
  private _kind: string;
  private _options: object;
  private _secrets: { [key: string]: string };
  private _name: string;
  private _rules: Map<number, ListenerRule> = new Map();
  private _vm: ivm.Isolate;
  private _active: number = 1;

  constructor(matrix: Matrix, { id, kind, name, options, secrets }: ListenerConfig) {
    this._id = id;
    this._name = name;
    this._kind = kind;
    this._options = options;
    this._secrets = secrets || {};
    this._matrix = matrix;

    this._vm = new ivm.Isolate({ memoryLimit: 64 });
  }

  static get fields(): SettingField[] {
    return [];
  }

  static testConnection?: (config: ListenerConfig) => Promise<ToolResult>;

  protected secret(key: string): string | undefined { return this._secrets[key]; }

  protected storeSecrets(changes: { [key: string]: string }): void {
    saveSecrets("listener", this.id, (this.constructor as typeof Listener).fields, changes);
    Object.assign(this._secrets, changes);
  }

  get active(): number { return this._active; }
  set active(value: number) { this._active = value; }
  get matrix(): Matrix { return this._matrix; }
  get kind(): string { return this._kind; }
  get options(): any { return this._options; }
  get id(): number {
    return this._id;
  }
  get vm(): ivm.Isolate { return this._vm; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      options: this.options
    };
  }

  get status(): ListenerStatus {
    return { state: this.active ? "running" : "disabled" };
  }

  abstract parseRules(...args: any): void;
  abstract start(): void;
  abstract stop(): void;

  update({ name, kind, options }: { name: string, kind: string, options: object }): boolean {
    this._name = name;
    this._kind = kind;
    this._options = options;

    const result = db.prepare(`
      UPDATE listeners
      SET name=?, kind=?, options=?
      WHERE id=?
    `).run(this.name, this.kind, JSON.stringify(this.options), this.id);

    return result.changes > 0;
  }

  loadRules(): void {
    const rows = db.prepare("SELECT * FROM listener_rules WHERE listener_id = ?")
      .all(this.id) as IListenerRule[];

    this._rules.clear();

    rows.forEach((row) => {
      this._rules.set(row.id, new ListenerRule(this, row));
      console.log('rule', row);
    });

    this.parseRules();
  }

  async checkHistory(uid: string | undefined | null): Promise<boolean> {
    if (!uid)
      return false;

    return await History.create(this.id, uid);
  }

  get name(): string {
    return this._name;
  }

  get rules(): Map<number, ListenerRule> {
    return this._rules;
  }

  execRule(listener_rule: IListenerRule, event: any): any {
    if (listener_rule.active !== 1)
      return;

    const context = this.vm.createContextSync();
    const jail = context.global;
    jail.setSync("global", jail.derefInto());
    jail.setSync("log", function(...args: any) {
      console.log(...args);
    });

    console.log("Executing rule in listener", this.name, "with event:", event);

    if (listener_rule.script) {
      const closure = context.evalClosureSync(
        listener_rule.script,
        [event],
        {
          timeout: 2000,
          arguments: { copy: true },
          result: { copy: true }
        }
      );

      return closure;
    }

    return false;
  }

  callActions(actions: ListenerAction[]) {
    actions.forEach(async (listenerAction) => {
      try {

        console.debug('listenerAction', listenerAction);

        const inHistory = await this.checkHistory(listenerAction.uid);
        if (listenerAction.uid && inHistory) {
          console.debug(`Duplicate event received for uid ${listenerAction.uid}, ignoring.`);
          return;
        }

        const { action, controller: controllerName, path, ...props } = listenerAction;

        if (typeof controllerName !== "string") {
          throw new Error("Listener action requires a valid 'controller' string.");
        }

        if (typeof path !== "string") {
          throw new Error("Listener action requires a valid 'path' string.");
        }

        if (typeof path !== "string") {
          throw new Error("Listener action requires a valid 'path' string.");
        }

        const controller = this.matrix.getController(controllerName);
        console.log('hasaction', controller);
        controller?.action(action, path, props);
      } catch (err: any) {
        console.log('Error on received listener action', listenerAction, err);
      }
    });
  }
}

export { Listener };

