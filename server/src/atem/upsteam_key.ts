import { Atem } from 'atem-connection';
import { FlyKeyKeyFrame } from 'atem-connection/dist/enums/index.js';
import { clamp } from "../utils.js"

class UpstreamKey {
  atem: Atem;
  meIndex: number;
  keyerIndex: number;
  maxScale: number = Infinity;
  minScale: number = -Infinity;

  constructor(atem: Atem, meIndex: number, keyerIndex: number) {
    this.atem = atem;
    this.meIndex = meIndex;
    this.keyerIndex = keyerIndex;
  }

  scale({ scale }: { scale: number }): void {
    scale = clamp(scale, this.minScale, this.maxScale)

    this._scaleTo({ x: scale * 1000, y: scale * 1000 });
  }

  shrink({ magnitude }: { magnitude: number }): void {
    let existingSize = this.atem.state?.video.mixEffects[this.meIndex]?.upstreamKeyers[this.keyerIndex]?.dveSettings?.sizeX;
    if (!existingSize) return;

    let targetSize = clamp(existingSize * (1 - (+magnitude)), this.minScale * 1000, this.maxScale * 1000);

    this._scaleTo({ x: targetSize, y: targetSize });
  }

  grow({ magnitude }: { magnitude: number }): void {
    let existingSize = this.atem.state?.video.mixEffects[this.meIndex]?.upstreamKeyers[this.keyerIndex]?.dveSettings?.sizeX;
    if (!existingSize) return;

    let targetSize = clamp(existingSize * (1 + (+magnitude)), this.minScale * 1000, this.maxScale * 1000);

    this._scaleTo({ x: targetSize, y: targetSize });
  }

  setMaxScale({ maxScale }: { maxScale: number }): void {
    this.maxScale = +maxScale;
  }

  setMinScale({ minScale }: { minScale: number }): void {
    this.minScale = +minScale;
  }

  reset(): void {
    this._scaleTo({ x: 1000, y: 1000 });
  }

  animationDuration({ duration }: { duration: number }): void {
    let rate = 30 * duration / 1000
    if (rate > 0) {
      this.atem.setUpstreamKeyerDVESettings({
        rate
      }, this.meIndex, this.keyerIndex);
    }
  }

  _scaleTo(size: { x: number, y: number }): void {
    this.atem.setUpstreamKeyerFlyKeyKeyframe(this.meIndex, this.keyerIndex, FlyKeyKeyFrame.A, {
      sizeX: size.x,
      sizeY: size.y
    });

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
      { action: "grow", props: { magnitude: "number" } },
      { action: "animationDuration", props: { duration: "number" } },
      { action: "setMinScale", props: { minScale: "number" } },
      { action: "setMaxScale", props: { maxScale: "number" } },
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
