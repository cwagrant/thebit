import { VM, VMScript } from "vm2";

abstract class Listener {
  private _name: string;
  private _rules: ListenerRule[] = [];
  private _history: string[] = [];

  constructor({ name, rules }: { name: string, rules: ListenerRule[] }) {
    this._name = name;

    rules.forEach((rule) => {
      this._rules.push({
        on: rule.on,
        function: rule.function
      })
    })
  }

  abstract parseRules(...args: any): void;

  checkHistory(uid: string | undefined | null): boolean {
    if (!uid)
      return false

    if (this._history.includes(uid)) {
      return true
    } else {
      this._history.push(uid);

      if (this._history.length > 100) {
        this._history.slice(0, (this._history.length - 100))
      }

      return false
    }
  }

  get name(): string {
    return this._name;
  }

  get rules(): ListenerRule[] {
    return this._rules;
  }

  execRule(rule: ListenerRule, event: any): any {
    try {
      let sandbox = {
        event: event,
        ruleFunc: rule.function
      };

      console.log("Executing rule in listener", this.name, "with event:", event);
      const vm = new VM({ sandbox });

      return vm.run(`ruleFunc(event);`);
    } catch (err: any) {
      console.log(`Error executing rule in listener '${this.name}' :`, err);
    }
  }
}

export { Listener };

