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

  // The settings this kind of controller needs. Fields marked `secret` are
  // stored encrypted and handed to the constructor as `secrets` rather than
  // as part of `options`.
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

  // Live connection state, surfaced on the controller's settings and invite
  // pages. Controllers that don't track one keep this default.
  get status(): ControllerStatus {
    return { state: "unknown" };
  }

  // Set by kinds whose device a remote user can publish through a tunnel -
  // see tunnel.ts.
  static get tunnel(): ControllerTunnel | undefined {
    return undefined;
  }

  // On-demand checks and setup steps this kind of controller offers - see
  // runTool.
  static get tools(): ControllerTool[] {
    return [];
  }

  async runTool(key: string): Promise<ToolResult> {
    return { ok: false, message: `Unknown tool '${key}'.` };
  }

  // Releases whatever the controller holds open (sockets, timers). Called
  // when the controller is being replaced by a freshly constructed one, so
  // unlike stop() there is no coming back from it.
  dispose(): void { }

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
      options: this.options,
      status: this.status
    };
  }
}

export default Controller;
export { Controller };
