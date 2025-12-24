import { UpstreamKey } from "./upsteam_key.js";
import { Actions } from '../action.js';
import { Atem } from "atem-connection";
import { MixEffectInfo } from "atem-connection/dist/state/info.js";

class MixEffectsBus {
  meIndex: number;
  upstreamKeys: {[key: string]: UpstreamKey} = {};

  constructor(atem: Atem, meIndex: number, info: MixEffectInfo) {
    this.meIndex = meIndex;

    for (let i = 0; i < info.keyCount; i++) {
      this.upstreamKeys[`upstreamKey${i}`] = new UpstreamKey(atem, meIndex, i);
    }
  }

  getActions(): Actions {
    const actions: Actions = {};

    for (let [key, value] of Object.entries(this.upstreamKeys)) {
      actions[key] = value.getActions();
    }

    return actions;
  }

  action(action: string, path: string[], props: any): void {
    const keyer = path.shift();
    if (!keyer) return;

    const upstreamKey = this.upstreamKeys[keyer];
    if (!upstreamKey) return;

    upstreamKey.action(action, path, props);
  }
}

export { MixEffectsBus };