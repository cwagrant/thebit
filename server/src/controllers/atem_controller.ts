import { Controller } from "./controller.js"
import { Atem, AtemState } from 'atem-connection';
import { Actions } from '../action.js';
import { MixEffectsBus } from "../atem/mix_effects_bus.js";

export default class ATEMController extends Controller {
  atem: Atem;
  mixEffectsBuses: MixEffectsBus[] = [];

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
      console.log('ATEM state changed: ', state);
      
      this._loadAtemState(state);
    });
  }

  _loadAtemState(state: AtemState) {
      this.mixEffectsBuses = state.info.mixEffects.map((mixEffectsBus, index) => {
        if (!mixEffectsBus) return null;
        return new MixEffectsBus(mixEffectsBus.keyCount);
      })
      .filter((bus) => bus !== null) as MixEffectsBus[];
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

    for (let i = 0; i < this.mixEffectsBuses.length; i++) {
      actions[`me${i}`] = this.mixEffectsBuses[i].getActions();
    }

    return actions;
  }
};