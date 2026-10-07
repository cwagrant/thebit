import ivm from 'isolated-vm';
import { Listener } from "./listener.js";

export class ListenerRule implements IListenerRule {
  _id: number;
  _listener_id: number;
  _message: string;
  _rule: ivm.Script | string;
  _listener: Listener;
  _active: number = 1;
  _script: string;
  _version: string;
  _condition: { [key: string]: any };

  constructor(listener: Listener, { id, listener_id, message, rule, active, version, condition }: IListenerRule) {
    this._id = id;
    this._listener_id = listener_id;
    this._message = message;
    this._listener = listener;
    this._active = active;
    this._script = rule.toString();
    this._version = version || "1";
    this._condition = ListenerRule.parseCondition(condition);

    this._rule = this._script;
    // this._rule = this.listener.vm.compileScriptSync(this._script);
  }

  private static parseCondition(condition: IListenerRule['condition']): { [key: string]: any } {
    if (!condition)
      return {};

    if (typeof condition !== "string")
      return condition;

    try {
      return JSON.parse(condition);
    } catch {
      return {};
    }
  }

  get id(): number { return this._id; }
  get listener_id(): number { return this._listener_id; }
  get listener(): Listener { return this._listener; }
  get message(): string { return this._message; }
  get rule(): ivm.Script | string { return this._rule; }
  get active(): number { return this._active; }
  get script(): string { return this._script; }
  get version(): string { return this._version; }
  get condition(): { [key: string]: any } { return this._condition; }
}
