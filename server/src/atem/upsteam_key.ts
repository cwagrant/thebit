import { Atem } from 'atem-connection';
import { Actions } from '../action.js';
import * as TWEEN from '@tweenjs/tween.js'
import { VideoMode } from 'atem-connection/dist/enums/index.js';

const DURATION = 500;

class UpstreamKey {
  atem: Atem;
  meIndex: number;
  keyerIndex: number;

  animation: TWEEN.Tween<{x: number, y: number}> | undefined;
  interval: NodeJS.Timeout | undefined;

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
    this.animation?.stop();
    clearInterval(this.interval);
    
    if (duration <= 0) {
      this._jumpTo(size);
      return;
    }

    let existingSettings = this.atem.state?.video.mixEffects[this.meIndex]?.upstreamKeyers[this.keyerIndex]?.dveSettings;
    if (!existingSettings) {
      this._jumpTo(size);
      return;
    }

    this.animation = new TWEEN.Tween<{x: number, y: number}>({
      x: existingSettings.sizeX,
      y: existingSettings.sizeY
    })
    .to(size, duration)
    .onUpdate((size) => {
      this._jumpTo(size);
    })
    .onComplete(() => {
      this.animation?.stop();
      this.animation = undefined;
      clearInterval(this.interval);
    })
    .start();

    this.interval = setInterval(
      () => {
        this.animation?.update();
      },
      1000 / this._framerate()
    );
  }

  _jumpTo(size: { x: number, y: number }): void {
    this.atem.setUpstreamKeyerDVESettings({
      sizeX: size.x,
      sizeY: size.y
    }, this.meIndex, this.keyerIndex)
  }

  _framerate(): number {
    let videoMode = this.atem.state?.settings.videoMode;
    if (videoMode === undefined) return 30;

    switch (videoMode) {
      case VideoMode.N1080p60:
        return 60;
      case VideoMode.N1080i5994:
      case VideoMode.N1080p5994:
      case VideoMode.N4KHDp5994:
      case VideoMode.N525i5994169:
      case VideoMode.N525i5994NTSC:
      case VideoMode.N720p5994:
      case VideoMode.N8KHDp5994:
        return 59.94;
      case VideoMode.P1080i50:
      case VideoMode.P1080p50:
      case VideoMode.P4KHDp5000:
      case VideoMode.P625i50169:
      case VideoMode.P625i50PAL:
      case VideoMode.P720p50:
      case VideoMode.P8KHDp50:
        return 50;
      case VideoMode.N1080p2398:
      case VideoMode.N4KHDp2398:
      case VideoMode.N8KHDp2398:
        return 23.98;
      case VideoMode.N1080p24:
      case VideoMode.N4KHDp24:
      case VideoMode.N8KHDp24:
        return 24;
      case VideoMode.P1080p25:
      case VideoMode.P4KHDp25:
      case VideoMode.P8KHDp25:
        return 25;
      case VideoMode.N1080p2997:
      case VideoMode.N4KHDp2997:
      case VideoMode.N8KHDp2997:
        return 29.97;
      case VideoMode.N1080p30:
        return 30;
    }
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