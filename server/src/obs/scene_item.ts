import { Scene } from "./scene.js";

type SceneItemProps = {
  name: string;
  id: number,
  scene: Scene;
  active: boolean;
  rotation: number;
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
  id!: number;
  private scene!: Scene;
  private active: boolean = true;
  rotation!: number;
  alignment!: Alignment;
  private commands: ObsCommand[] = [];
  private defaultSize!: { width: number, height: number };
  private defaultPosition!: { x: number, y: number };
  private defaultScale!: { x: number, y: number };
  private defaultAlignment!: Alignment;
  currentPosition: { x: number, y: number };
  currentSize: { width: number, height: number };
  currentScale: { x: number, y: number };

  constructor(props: SceneItemProps) {
    Object.assign(this, props)

    this.currentScale = this.defaultScale;
    this.currentSize = this.defaultSize;
    this.currentPosition = this.defaultPosition;
    this.alignment = this.defaultAlignment;
  }

  loadState(state: SceneItem): void {
    this.currentSize = state.currentSize
    this.defaultSize = state.defaultSize
    this.currentPosition = state.currentPosition
    this.defaultPosition = state.defaultPosition
    this.currentScale = state.currentScale
    this.defaultScale = state.defaultScale
    this.alignment = state.alignment
    this.defaultAlignment = state.defaultAlignment
  }

  // Destructive action that returns the list of commands
  // to be ran by OBS to bring this scene up to date.
  getCommands(): ObsCommand[] {
    return this.commands.splice(0, this.commands.length);
  }

  getTransform(): any {
    return {
      rotation: 0,
      alignment: this.alignment,
      height: this.defaultHeight(),
      width: this.defaultWidth(),
      positionX: this.defaultX(),
      positionY: this.defaultY(),
      scaleX: this.defaultScaleX(),
      scaleY: this.defaultScaleY()
    }
  }

  toJSON(): any {
    return { ...this, scene: this.scene.name }
  }

  center(): void {
    this.alignment = Alignment.Center;
    this.currentPosition = {
      x: this.defaultWidth() / 2,
      y: this.defaultHeight() / 2
    }
  }

  reset(): void {
    this.rotation = 0;
    this.currentPosition = this.defaultPosition;
    this.currentScale = this.defaultScale;
    this.currentSize = this.defaultSize;
    this.alignment = this.defaultAlignment
  }

  scale(scaleX: number, scaleY?: number): void {
    this.currentScale = {
      x: scaleX,
      y: scaleY ?? scaleX
    }

    this.currentSize = {
      height: this.defaultHeight() * this.scaleX(),
      width: this.defaultWidth() * this.scaleY(),
    }
  }

  adjustSize(magnitude: number): void {
    const newScale = this.scaleX() * magnitude;
    console.log('newScale', newScale)
    this.scale(newScale)
  }

  rotate(angle: number): void {
    this.rotation += angle;
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
