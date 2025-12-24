import { Controller } from "./controller.js"
import { Atem } from 'atem-connection';
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
    });
    this.atem.on('stateChanged', (state) => {
      let mixEffectsBuses = [];
      
      for (let mixEffectsBus of state.info.mixEffects) {
        if (!mixEffectsBus) continue;
        mixEffectsBuses.push(new MixEffectsBus(mixEffectsBus.keyCount));
      }

      this.mixEffectsBuses = mixEffectsBuses;
    });
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