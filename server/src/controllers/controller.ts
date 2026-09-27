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
