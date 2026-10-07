import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";
import type { Controller } from "../controllers/index.js";

class ManualListener extends Listener {
  constructor(matrix: Matrix, config: any) {
    super(matrix, config);

    this.start();
  }

  start(): void {
    if (!this.active) {
      return;
    }

    this.loadRules();
  }

  stop(): void {
  }

  parseRules(): void {
  }

  get controllers(): Controller[] {
    const allowed: unknown = this.options?.controllers;
    const controllers = [...this.matrix.controllers.values()];

    if (!Array.isArray(allowed)) {
      return controllers;
    }

    return controllers.filter((controller) => allowed.includes(controller.name));
  }

  trigger(ruleId: number): boolean {
    const rule = this.rules.get(ruleId);

    if (!rule) {
      return false;
    }

    const executionResult: ListenerAction | ListenerAction[] = this.execRule(rule, {});
    const listenerActions = (Array.isArray(executionResult) ? executionResult : [executionResult]).filter(Boolean);

    this.callActions(listenerActions);

    return true;
  }
}

export default ManualListener;
export { ManualListener };
