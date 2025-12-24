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
      sizeX: scale * 1000,
      sizeY: scale * 1000
    }, this.meIndex, this.keyerIndex)
  }

  shrink({ magnitude }: { magnitude: number }): void {
    let existingSize = this.atem.state?.video.mixEffects[this.meIndex]?.upstreamKeyers[this.keyerIndex]?.dveSettings?.sizeX;
    if (!existingSize) return;

    let targetSize = existingSize * magnitude;
    this.atem.setUpstreamKeyerDVESettings({
      sizeX: targetSize,
      sizeY: targetSize
    }, this.meIndex, this.keyerIndex);
  }

  reset(): void {
    this.atem.setUpstreamKeyerDVESettings({
      sizeX: 1000,
      sizeY: 1000
    }, this.meIndex, this.keyerIndex);
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