abstract class Controller implements IController {
  private _id: number;
  private _name: string;
  private _kind: string;
  private _options: any;

  constructor({ id, name, kind, options }: IController) {
    this._id = id;
    this._name = name;
    this._kind = kind;
    this._options = options;
  }
  active: boolean = true;

  abstract start(): boolean
  abstract reset(): boolean
  abstract stop(): boolean
  abstract action(...args: any): void

  get id(): number { return this._id; };
  get name(): string { return this._name; };
  get kind(): string { return this._kind; };
  get options(): any { return this._options; };

  // The actions this controller currently exposes, as a tree keyed by path
  // segment (an OBS scene name, or ATEM me0 -> upstreamKey0) with a list of
  // Action descriptors at each leaf. The remote control view renders this,
  // and only actions that appear in it can be fired from there - see
  // hasAction below.
  getActions(): Actions {
    return {};
  }

  hasAction(action: string, path: string[]): boolean {
    let node: Actions | undefined = this.getActions();

    for (const segment of path) {
      if (!node || Array.isArray(node)) {
        return false;
      }

      node = node[segment];
    }

    return Array.isArray(node) && node.some((candidate) => candidate.action === action);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      options: this.options
    };
  }
}

export default Controller;
export { Controller };
