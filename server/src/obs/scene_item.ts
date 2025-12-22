import { Scene } from "./scene.js";

type SceneItemProps = {
  name: string;
  scene: Scene;
  active: boolean;
  rotation: number;
  transformFilterName: string;
  defaultSize: { width: number, height: number };
  defaultPosition: { x: number, y: number };
  defaultScale: { x: number, y: number };
  defaultAlignment: Alignment;
}

// This is based on OBS's alignments.
enum Alignment {
  Center,
  CenterLeft,
  CenterRight,
  Unused1, // 3
  TopCenter,
  TopLeft,
  TopRight,
  Unused2, // 7
  BottomCenter,
  BottomLeft,
  BottomRight
}

interface ObsCommand {
  command: string;
  props: any;
}

class SceneItem {
  name!: string;
  private scene!: Scene;
  private active: boolean = true;
  private rotation!: number;
  private alignment!: Alignment;
  private commands: ObsCommand[] = [];
  private transformFilterName!: string;
  private defaultSize!: { width: number, height: number };
  private defaultPosition!: { x: number, y: number };
  private defaultScale!: { x: number, y: number };
  private defaultAlignment!: Alignment;
  private currentPosition: { x: number, y: number };
  private currentSize: { width: number, height: number };
  private currentScale: { x: number, y: number };

  constructor(props: SceneItemProps) {
    Object.assign(this, props)

    this.currentScale = this.defaultScale;
    this.currentSize = this.defaultSize;
    this.currentPosition = this.defaultPosition;
    this.alignment = this.defaultAlignment;
  }

  // Destructive action that returns the list of commands
  // to be ran by OBS to bring this scene up to date.
  getCommands(): ObsCommand[] {
    return this.commands.splice(0, this.commands.length);
  }

  getTransform(): any {
    return {
      pos: this.currentPosition,
      rot: this.rotation,
      scale: this.currentScale,
    }
  }

  toJSON(): any {
    return { ...this, scene: this.scene.name }
  }

  enableFilter(filterName: string): void {
    this.commands.push({
      command: "SetSourceFilterEnabled",
      props: {
        sourceName: this.scene.name,
        filterName: filterName,
        filterEnabled: true
      }
    })
  }

  pushTransform(): void {
    this.commands.push({
      command: "SetSourceFilterSettings",
      props: {
        sourceName: this.scene.name,
        filterName: this.transformFilterName,
        filterSettings: this.getTransform()
      }
    })
  }

  reset(): void {
    this.rotation = 0;
    this.currentPosition = this.defaultPosition;
    this.currentScale = this.defaultScale;
    this.currentSize = this.defaultSize;
    this.alignment = this.defaultAlignment

    this.setSceneItemTransform({
      alignment: this.alignment,
      height: this.defaultHeight(),
      width: this.defaultWidth(),
      positionX: this.defaultX(),
      positionY: this.defaultY(),
      scaleX: this.defaultScaleX(),
      scaleY: this.defaultScaleY()
    })
  }

  setSceneItemTransform(props: any): void {
    this.commands.push({
      command: "SetSceneItemTransform",
      props: props
    })
  }

  scale(scaleX: number, scaleY?: number): void {
    this._scale(scaleX, scaleY ?? scaleX)
    this.pushTransform();
    this.enableFilter(this.transformFilterName);
  }

  // Private version of the Scale method used to do the
  // actual scaling logic. The public version of the method
  // only queues up the commands to be sent to OBS to perform
  // the actual scaling.
  _scale(scaleX: number, scaleY?: number): void {
    this.currentScale = {
      x: scaleX,
      y: scaleY ?? scaleX
    }

    this.currentSize = {
      height: this.defaultHeight() * this.scaleX(),
      width: this.defaultWidth() * this.scaleY(),
    }
  }

  rotate(angle: number): void {
    this._rotate(angle)
    this.pushTransform()
    this.enableFilter(this.transformFilterName)
  }

  _rotate(angle: number): void {
    this.rotation += angle;

    const isSideways = (angle % 180) == 90
    const upsideDown = (angle % 360) >= 180

    this._scale(isSideways ? (9 / 16) : 1)

    if (isSideways) {
      this.currentPosition = {
        x: upsideDown ? (this.defaultWidth() / 2) - (this.height() / 2) : (this.defaultWidth() / 2) + (this.height() / 2),
        y: 0
      }
    } else {

      this.currentPosition = {
        x: upsideDown ? this.defaultWidth() : this.currentPosition["x"],
        y: upsideDown ? this.defaultHeight() : this.currentPosition["y"]
      }
    }
  }

  height(): number {
    return this.currentSize["height"]
  }

  width(): number {
    return this.currentSize["width"]
  }

  defaultHeight(): number {
    return this.defaultSize["height"]
  }

  defaultWidth(): number {
    return this.defaultSize["width"]
  }

  defaultX(): number {
    return this.defaultPosition["x"]
  }

  defaultY(): number {
    return this.defaultPosition["y"]
  }

  defaultScaleX(): number {
    return this.defaultScale["x"];
  }

  defaultScaleY(): number {
    return this.defaultScale["y"];
  }

  scaleX(): number {
    return this.currentScale["x"];
  }

  scaleY(): number {
    return this.currentScale["y"];
  }

}

export { Alignment, ObsCommand, SceneItem, SceneItemProps }
