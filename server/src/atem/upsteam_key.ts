import { Atem } from 'atem-connection';
import { Actions } from '../action.js';

class UpstreamKey {
  atem: Atem;
  meIndex: number;
  keyerIndex: number;

  constructor(atem: Atem, meIndex: number, keyerIndex: number) {
    this.atem = atem;
    this.meIndex = meIndex;
    this.keyerIndex = keyerIndex;
  }

  scale({ scale }: { scale: number }): void {
    this.atem.setUpstreamKeyerDVESettings({
      sizeX: scale,
      sizeY: scale
    }, this.meIndex, this.keyerIndex)
  }

  shrink({ magnitude }: { magnitude: number }): void {
    
  }

  getActions(): Actions {
    return [
      { action: "scale", props: { scale: "number" } },
      { action: "scale", options: { scale: [0.2, 0.5, 1, 2.5] } },
      { action: "reset", props: {} },
      { action: "shrink", props: { magnitude: "number" } },
    ]
  }

  action(action: string, path: string[], props: any): void {
    if (path.length > 0) return;

    const actionFunc: any = (this as any)[action];

    if (typeof actionFunc === "function") {
      console.log(`responds to ${action}`, props)
      actionFunc.apply(this, [props]);
    }
  }
}

export { UpstreamKey };