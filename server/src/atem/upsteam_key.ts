import { Atem } from 'atem-connection';
import { Actions } from '../action.js';
import { FlyKeyKeyFrame } from 'atem-connection/dist/enums/index.js';

const DURATION = 500;

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
    this._scaleTo({ x: scale * 1000, y: scale * 1000 }, DURATION);
  }

  shrink({ magnitude }: { magnitude: number }): void {
    let existingSize = this.atem.state?.video.mixEffects[this.meIndex]?.upstreamKeyers[this.keyerIndex]?.dveSettings?.sizeX;
    if (!existingSize) return;

    let targetSize = existingSize * magnitude;

    this._scaleTo({ x: targetSize, y: targetSize }, DURATION);
  }

  reset(): void {
    this._scaleTo({ x: 1000, y: 1000 }, DURATION);
  }

  _scaleTo(size: { x: number, y: number }, duration: number): void {
    if (duration <= 0) {
      this._jumpTo(size);
      return;
    }

    this.atem.setUpstreamKeyerFlyKeyKeyframe(this.meIndex, this.keyerIndex, FlyKeyKeyFrame.A, {
      sizeX: size.x,
      sizeY: size.y
    });

    this.atem.setUpstreamKeyerDVESettings({
      rate: 30 * duration / 1000
    }, this.meIndex, this.keyerIndex);

    this.atem.runUpstreamKeyerFlyKeyTo(this.meIndex, this.keyerIndex, FlyKeyKeyFrame.A);
  }

  _jumpTo(size: { x: number, y: number }): void {
    this.atem.setUpstreamKeyerDVESettings({
      sizeX: size.x,
      sizeY: size.y
    }, this.meIndex, this.keyerIndex)
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