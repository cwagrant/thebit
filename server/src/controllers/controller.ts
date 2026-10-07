abstract class Controller implements IController {
  private _id: number;
  private _name: string;
  private _kind: string;
  private _options: any;
  private _secrets: { [key: string]: string };

  constructor({ id, name, kind, options, secrets }: IController) {
    this._id = id;
    this._name = name;
    this._kind = kind;
    this._options = options;
    this._secrets = secrets || {};
  }
  active: boolean = true;

  static get fields(): SettingField[] {
    return [];
  }

  abstract start(): boolean
  abstract reset(): boolean
  abstract stop(): boolean
  abstract action(...args: any): void

  get id(): number { return this._id; };
  get name(): string { return this._name; };
  get kind(): string { return this._kind; };
  get options(): any { return this._options; };
  protected secret(key: string): string | undefined { return this._secrets[key]; };

  get status(): ControllerStatus {
    return { state: "unknown" };
  }

  static get tunnel(): ControllerTunnel | undefined {
    return undefined;
  }

  static get tools(): ControllerTool[] {
    return [];
  }

  async runTool(key: string): Promise<ToolResult> {
    return { ok: false, message: `Unknown tool '${key}'.` };
  }

  dispose(): void { }

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
      options: this.options,
      status: this.status
    };
  }
}

export default Controller;
export { Controller };
