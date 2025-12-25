import { VM, VMScript } from "vm2";

abstract class Listener {
  private _name: string;
  private _rules: ListenerRule[] = [];

  constructor({ name, rules }: { name: string, rules: ListenerRule[] }) {
    this._name = name;

    rules.forEach((rule) => {
      this._rules.push({
        on: rule.on,
        uid: rule.uid,
        function: new VMScript(rule.function)
      })
    })
  }

  abstract parseRules(...args: any): void;

  get name(): string {
    return this._name;
  }

  get rules(): ListenerRule[] {
    return this._rules;
  }

  execRule(func: VMScript, event: any): any {
    try {
      let sandbox = {
        event: event,
      };

      console.log("Executing rule in listener", this.name, "with event:", event);
      const vm = new VM({ sandbox });

      return vm.run(func)
    } catch (err: any) {
      console.log(`Error executing rule in listener '${this.name}' :`, err);
    }
  }
}

export { Listener };

