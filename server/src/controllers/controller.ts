abstract class Controller implements IController {
  id!: string;
  active: boolean = true;

  abstract start(): boolean
  abstract reset(): boolean
  abstract stop(): boolean
  abstract action(...args: any): void
}

export { Controller }
