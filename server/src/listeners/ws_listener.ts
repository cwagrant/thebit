import Client from "../client.js";
import { Listener } from "./base.js";
import ObsController from "../controllers/obs_controller.js";
import ATEMController from "../controllers/atem_controller.js";

class WSListener extends Listener {
  private _socket;

  constructor(config: any) {
    super(config);

    this._socket = new Client(config.address)
  }

  get socket() {
    return this._socket;
  }

  parseRules(controller: IController): void {
    this.rules.forEach((rule) => {
      this.socket.on(rule.on, (args: any) => {
        const listenerAction: ListenerAction = this.execRule(rule.script, args);
        console.debug('listenerAction', listenerAction)

        if (this.checkHistory(listenerAction.uid)) {
          console.debug(`Duplicate event received for uid ${listenerAction.uid}, ignoring.`)
          return;
        }

        console.debug('listenerAction', listenerAction, args)

        if (controller instanceof ObsController) {
          try {
            let { action, path, ...props } = listenerAction

            if (!action) {
              return;
            }

            if (!path) {
              controller.scenes.forEach((scene) => {
                controller.action(action, scene.name, props);
              })
            } else {
              controller.action(action, path, props);
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
