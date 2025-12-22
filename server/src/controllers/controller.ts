abstract class Controller {
  id!: string;
  active: boolean = true;

  abstract start(): boolean
  abstract reset(): boolean
  abstract stop(): boolean

  dumpState(): boolean {
    return false
  }

  loadState(): boolean {
    return false
  }
}

export { Controller }
