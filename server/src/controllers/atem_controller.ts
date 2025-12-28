import { Controller } from "./controller.js"
import { Atem, AtemState } from 'atem-connection';
import { MixEffectsBus } from "../atem/mix_effects_bus.js";

export default class ATEMController extends Controller {
  atem: Atem;
  mixEffectsBuses: { [key: string]: MixEffectsBus } = {};

  constructor() {
    super();

    this.atem = new Atem();
    this.atem.on('info', console.log);
    this.atem.on('error', console.error);
    this.atem.on('connected', () => {
      console.log('ATEM connected');

      let state = this.atem.state;
      if (state) {
        this._loadAtemState(state);
      }
    });
    this.atem.on('stateChanged', (state) => {
      console.log('ATEM state changed');

      this._loadAtemState(state);
    });
  }

  _loadAtemState(state: AtemState) {
    for (let i = 0; i < state.info.mixEffects.length; i++) {
      const mixEffectsBus = state.info.mixEffects[i];
      if (!mixEffectsBus) continue;
      this.mixEffectsBuses[`me${i}`] = new MixEffectsBus(this.atem, i, mixEffectsBus);
    }
  }

  connect(ipAddress: string) {
    console.log(`Connecting to ATEM at ${ipAddress}...`);

    this.atem.connect(ipAddress);
  }

  start(): boolean {
    return true;
  }

  stop(): boolean {
    return true;
  }

  reset(): boolean {
    return false;
  }

  getActions(): Actions {
    const actions: Actions = {};

    for (let [key, value] of Object.entries(this.mixEffectsBuses)) {
      actions[key] = value.getActions();
    }

    return actions;
  }

  getNormalizedState(): null {
    return null;
  }

  action(action: string, path: string[], props: any): void {
    const me = path.shift();
    if (!me) return;

    const meBus = this.mixEffectsBuses[me];
    if (!meBus) return;

    meBus.action(action, path, props);
  }
};
