interface IController {
  active: boolean;
  scaleX: number;
  scaleY: number;
  posX: number;
  posY: number;
  angle: number;
  height: number;
  width: number;
  defaultHeight: number;
  defaultWidth: number;

  start(): boolean;
  reset(): boolean;
  stop(): boolean;
}
