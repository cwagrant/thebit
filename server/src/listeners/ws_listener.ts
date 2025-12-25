import Client from "../client.js";
import { Listener } from "./base.js";
import ObsController from "../controllers/obs_controller.js";
import ATEMController from "../controllers/atem_controller.js";

class WSListener extends Listener {
  private _socket;
  private _history: string[] = [];

  constructor(config: any) {
    super(config);

    this._socket = new Client(config.address)
  }

  get socket() {
    return this._socket;
  }

  checkHistory(uid: string): boolean {
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

  parseRules(controller: IController): void {
    this.rules.forEach((rule) => {
      this.socket.on(rule.on, (args: any) => {
        if (rule.uid in args) {
          if (this.checkHistory(args[rule.uid])) {
            console.debug(`Duplicate event received for uid ${args[rule.uid]}, ignoring.`)
            return;
          }
        }
        const listenerAction = this.execRule(rule.function, args);

        console.debug('listenerAction', listenerAction, args)

        if (controller instanceof ObsController) {
          try {
            let { action, sceneName, ...props } = listenerAction

            if (!action) {
              return;
            }

            if (!sceneName) {
              controller.scenes.forEach((scene) => {
                controller.action(action, scene.name, props);
              })
            } else {
              controller.action(action, sceneName, props);
            }
          }
          catch (err: any) {
            console.error("Error executing listener action:", err)
          }
        } else if (controller instanceof ATEMController) {
          try {
            let { action, path, ...args } = listenerAction

            if (!action) {
              return
            }

            if (typeof path !== "string") {
              throw new Error("ATEM Listener action requires a valid 'path' string.")
            }

            if (typeof action !== "string") {
              throw new Error("ATEM Listener action requires a valid 'action' string.")
            }

            controller.action(action, path.split("."), args);
          } catch (err: any) {
            console.error("Error executing listener action:", err)
          }
        }
      })
    })
  }
}

export { WSListener }
