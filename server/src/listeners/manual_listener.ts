import { Listener } from "./listener.js";
import type Matrix from "../matrix.js";
import type { Controller } from "../controllers/index.js";

// A listener with no external event source at all. Its rules exist purely
// to be fired on demand - e.g. from the client's remote control view - via
// trigger(), rather than in response to anything arriving over a socket.
// There's nothing to connect to, so start()/stop() just manage the rule set.
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
    // No connection to tear down.
  }

  parseRules(): void {
    // Rules are already loaded into `this.rules` by the time this runs;
    // there's nothing to wire up ahead of time since nothing arrives on its
    // own - see trigger().
  }

  // The controllers this listener's remote control can fire actions on
  // directly: every loaded controller, or only the ones named in an optional
  // `controllers` array in the listener's options.
  get controllers(): Controller[] {
    const allowed: unknown = this.options?.controllers;
    const controllers = [...this.matrix.controllers.values()];

    if (!Array.isArray(allowed)) {
      return controllers;
    }

    return controllers.filter((controller) => allowed.includes(controller.name));
  }

  // Runs the given rule's script with an empty event (there's no external
  // payload for a manually-triggered rule) and dispatches whatever action it
  // produces. Returns false if no such rule exists on this listener.
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
