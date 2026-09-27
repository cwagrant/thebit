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

  constructor(listener: Listener, { id, listener_id, message, rule, active }: IListenerRule) {
    this._id = id;
    this._listener_id = listener_id;
    this._message = message;
    this._listener = listener;
    this._active = active;
    this._script = rule.toString();

    this._rule = this._script;
    // this._rule = this.listener.vm.compileScriptSync(this._script);
  }

  get id(): number { return this._id; }
  get listener_id(): number { return this._listener_id; }
  get listener(): Listener { return this._listener; }
  get message(): string { return this._message; }
  get rule(): ivm.Script | string { return this._rule; }
  get active(): number { return this._active; }
  get script(): string { return this._script; }
}
