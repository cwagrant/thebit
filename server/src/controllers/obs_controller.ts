import Controller from "./controller.js";
import { Scene, SceneItem } from "../obs/index.js";
import ObsWebSocket from "obs-websocket-js";
import { existsSync, readFileSync } from "node:fs";
import db from "../db.js";

// Where scene state lived before it moved into the controller_state table -
// one file shared by every OBS controller. Still read once, by a controller
// that has no saved state of its own yet.
const LEGACY_STATE_FILE = "obs_controller.state.json";

// The Move plugin's "Move Source" filter - what each scene's
// moveTransitionFilterName is expected to be.
const MOVE_SOURCE_FILTER_KIND = "move_source_filter";

export default class ObsController extends Controller {
  scenes: Map<string, Scene> = new Map();
  url: string | undefined;
  obs: any;
  connectionAttempts: number = 0;
  connected: boolean = false;
  disposed: boolean = false;
  lastError: string | undefined;
  reconnectTimer: NodeJS.Timeout | undefined;
  gameSceneNamePrefix = 'Transform';
  gameSceneItemNamePrefix = 'game';
  password: string | undefined;
  configScenes: any;

  constructor(config: IController) {
    super(config);

    const { url, scenes } = config.options;

    // A bare host:port is taken to mean a plain ws:// connection. With no
    // url at all, obs-websocket-js falls back to ws://127.0.0.1:4455.
    this.url = url && !/^wss?:\/\//.test(url) ? `ws://${url}` : url;
    this.password = this.secret("password");
    this.obs = new ObsWebSocket();
    this.configScenes = scenes || [];
    this.bindConnectionEvents();
    this.bindStartupEvents();
    this.connect().catch((err: any) => {
      console.error("OBS Error: Failed to connect:", err);
    });
  }

  static get kind(): string {
    return "obs";
  }

  static get fields(): SettingField[] {
    return [
      {
        key: "url",
        label: "OBS WebSocket URL",
        type: "ws-url",
        required: true,
        invite: true,
        placeholder: "ws://192.168.1.10:4455",
        help: "The address of OBS's WebSocket server (Tools > WebSocket Server Settings in OBS). Use wss:// for a tunnel."
      },
      {
        key: "password",
        label: "OBS WebSocket password",
        type: "password",
        secret: true,
        invite: true,
        help: "The server password shown under 'Show Connect Info' in OBS's WebSocket Server Settings."
      },
      {
        key: "scenes",
        label: "Scenes",
        type: "scenes",
        help: "The scenes this controller manages, with the game source, filters and sources to control in each."
      }
    ];
  }

  static get tunnel(): ControllerTunnel {
    // 4455 is the port OBS's WebSocket server listens on unless changed.
    return { field: "url", name: "obs", localPort: 4455 };
  }

  static get tools(): ControllerTool[] {
    return [
      {
        key: "move-transition",
        label: "Check for Move plugin",
        help: "Scenes are animated through the Move plugin's filters, so it needs to be installed in this OBS."
      },
      {
        key: "setup-scenes",
        label: "Set up scenes",
        help: "Creates any configured scene that's missing in OBS, and its Move Source filter. Sources are left for you to add."
      }
    ];
  }

  async runTool(key: string): Promise<ToolResult> {
    if (key !== "move-transition" && key !== "setup-scenes")
      return super.runTool(key);

    if (!this.connected)
      return { ok: false, message: "Not connected to OBS yet." };

    let installed: boolean;

    try {
      installed = await this.movePluginInstalled();
    } catch (err: any) {
      return { ok: false, message: `Couldn't ask OBS what's installed: ${err?.message || err}` };
    }

    if (!installed)
      return { ok: false, message: "The Move plugin wasn't found in this OBS. Install it from https://github.com/exeldro/obs-move-transition and restart OBS." };

    return key === "setup-scenes"
      ? this.setupScenes()
      : { ok: true, message: "The Move plugin is installed." };
  }

  private async movePluginInstalled(): Promise<boolean> {
    try {
      const { sourceFilterKinds } = await this.obs.call("GetSourceFilterKindList");

      return sourceFilterKinds.includes(MOVE_SOURCE_FILTER_KIND);
    } catch {
      // GetSourceFilterKindList needs obs-websocket 5.4+ - older versions
      // can still tell us about the transition the plugin also registers.
      const { transitionKinds } = await this.obs.call("GetTransitionKindList");

      return transitionKinds.includes("move_transition");
    }
  }

  // Creates whatever is missing in OBS for each configured scene: the scene
  // itself, and the Move Source filter on it that transitions run through.
  // Deliberately stops there - the game source and any other sources and
  // filters a scene's config names are left for the user to add, since what
  // they capture is specific to their machine. Nothing that already exists
  // is modified.
  private async setupScenes(): Promise<ToolResult> {
    const details: string[] = [];
    let failed = false;
    let created = false;

    if (this.configScenes.length === 0)
      return { ok: false, message: "This controller has no scenes configured." };

    const { scenes: obsScenes } = await this.getSceneList();

    for (const cScene of this.configScenes) {
      const sceneName = cScene.name;
      const filterName = cScene.moveTransitionFilterName;

      if (!sceneName) {
        details.push("Skipped a scene with no name configured.");
        continue;
      }

      try {
        if (!obsScenes.some((scene: any) => scene.sceneName === sceneName)) {
          await this.obs.call("CreateScene", { sceneName });
          created = true;
          details.push(`Created scene '${sceneName}'.`);
        }

        if (!filterName) {
          details.push(`Scene '${sceneName}' has no moveTransitionFilterName configured, so no filter was added.`);
          continue;
        }

        const { filters } = await this.obs.call("GetSourceFilterList", { sourceName: sceneName });
        const existing = filters.find((filter: any) => filter.filterName === filterName);

        if (existing && existing.filterKind !== MOVE_SOURCE_FILTER_KIND) {
          failed = true;
          details.push(`Scene '${sceneName}' already has a filter named '${filterName}', but it isn't a Move Source filter - left as it is.`);
        } else if (existing) {
          details.push(`Scene '${sceneName}' already has its '${filterName}' filter.`);
        } else {
          await this.obs.call("CreateSourceFilter", {
            sourceName: sceneName,
            filterName,
            filterKind: MOVE_SOURCE_FILTER_KIND,
            // Which scene item the filter moves. The source may not be in
            // the scene yet - that's the user's to add.
            filterSettings: cScene.gameSource ? { source: cScene.gameSource } : {}
          });
          // Filters are created enabled, and enabling is what makes a Move
          // filter run - transitions enable it themselves (Scene.transition).
          await this.obs.call("SetSourceFilterEnabled", { sourceName: sceneName, filterName, filterEnabled: false });
          created = true;
          details.push(`Added Move Source filter '${filterName}' to scene '${sceneName}'.`);
        }
      } catch (err: any) {
        failed = true;
        details.push(`Scene '${sceneName}': ${err?.message || err}`);
      }
    }

    if (failed)
      return { ok: false, message: "Some scenes couldn't be set up.", details };

    return {
      ok: true,
      message: created
        ? "Scenes set up. Add each scene's game source in OBS, then save this controller to load it."
        : "Nothing to do - every configured scene and its Move filter already exist.",
      details
    };
  }

  get status(): ControllerStatus {
    if (this.connected)
      return { state: "connected" };

    return { state: this.lastError ? "disconnected" : "connecting", error: this.lastError };
  }

  async connect(): Promise<void> {
    try {
      await this.obs.connect(this.url, this.password);
    } catch (err: any) {
      this.lastError = err?.message || String(err);
      throw err;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.connected = false;
    clearTimeout(this.reconnectTimer);
    this.obs.disconnect().catch(() => { });
  }

  dumpState(): void {
    const state = Object.fromEntries(this.scenes);

    db.prepare(`
      INSERT INTO controller_state (controller_id, state)
      VALUES (?, ?)
      ON CONFLICT(controller_id) DO UPDATE SET state = excluded.state
    `).run(this.id, JSON.stringify(state));
  }

  private savedState(): string | undefined {
    const row = db.prepare("SELECT state FROM controller_state WHERE controller_id = ?").get(this.id) as { state: string } | undefined;

    if (row)
      return row.state;

    return existsSync(LEGACY_STATE_FILE) ? readFileSync(LEGACY_STATE_FILE, "utf-8") : undefined;
  }

  loadState(): void {
    try {
      const data = this.savedState();

      if (data === undefined)
        return;

      const state = JSON.parse(data);
      for (const [sceneName, sceneState] of Object.entries(state)) {
        const scene = this.getScene(sceneName);
        // A scene whose game source isn't in OBS (yet) has nothing to
        // restore state onto.
        if (scene?.getSceneItem()) {
          scene.loadState(sceneState);
        }
      }
    } catch (err: any) {
      console.error("Failed to load saved scene state", err);
    }
  }

  start(): boolean {
    this.active = true;

    return this.active;
  }

  stop(): boolean {
    this.active = false;

    return this.active;
  }

  reset(): boolean {
    return false;
  }

  bindConnectionEvents(): void {
    this.obs.on("ConnectionError", (err: any) => {
      console.error("OBS Error:", err);
    });

    this.obs.on("ConnectionClosed", () => {
      this.connected = false;

      // Replaced by a newer instance (see Matrix.reloadController) - a
      // disposed controller must not keep dialling its old address.
      if (this.disposed)
        return;

      const intervalTime = this.connectionAttempts * 1000;
      const reconnectWait = intervalTime > 10000 ? 10000 : intervalTime;

      if (this.connectionAttempts === 0) {
        console.debug('OBS Connection Closed');
      }

      this.reconnectTimer = setTimeout(async () => {
        this.connectionAttempts = this.connectionAttempts + 1;
        console.debug(`OBS Reconnection Attempt ${this.connectionAttempts}`);
        try { await this.connect(); } catch { }
      }, reconnectWait);
    });

    this.obs.on("ConnectionOpened", () => {
      console.debug("OBS Connection Opened");
    });

    // Only reset the attempt counter once OBS has actually accepted us.
    // ConnectionOpened fires as soon as the socket opens, before auth - a
    // bad password would otherwise reset the counter (and the backoff) on
    // every single attempt.
    this.obs.on("Identified", () => {
      this.connectionAttempts = 0;
      this.connected = true;
      this.lastError = undefined;
      console.debug("OBS Connection Identified");
    });
  }

  bindStartupEvents(): void {
    this.obs.once("Identified", async () => {
      const { scenes: obsScenes } = await this.getSceneList();

      for (const cScene of this.configScenes) {
        console.log('load scene', cScene);
        const oScene = obsScenes.find((s: any) => s.sceneName === cScene.name);

        if (!oScene) {
          continue;
        }

        const scene = this.addScene(new Scene({
          name: oScene.sceneName,
          uuid: oScene.sceneUuid,
          transitionFilterName: cScene.moveTransitionFilterName
        }));

        const oSceneItems = await this.getSceneItemList({
          sceneName: scene.name,
        }) || [];

        for (const oSceneItem of oSceneItems) {
          if (oSceneItem.sourceName == cScene.gameSource) {
            const transform = oSceneItem.sceneItemTransform;
            scene.setSceneItem(new SceneItem({
              name: oSceneItem.sourceName,
              id: oSceneItem.sceneItemId,
              scene: scene,
              active: true,
              defaultPosition: { x: transform.positionX, y: transform.positionY },
              defaultScale: { x: transform.scaleX, y: transform.scaleY },
              defaultSize: { width: transform.width, height: transform.height },
              defaultAlignment: transform.alignment,
              rotation: transform.rotation,
              maxScale: cScene.maxScale,
              minScale: cScene.minScale
            }));
          } else if ((cScene.sources || []).includes(oSceneItem.sourceName)) {
            scene.addSource({
              name: oSceneItem.sourceName,
              enabled: oSceneItem.sceneItemEnabled,
              id: oSceneItem.sceneItemId,
              uuid: oSceneItem.sourceUuid
            });
          }
        }

        const oFilters = await this.getSourceFilterList(scene.uuid);

        for (const oFilter of oFilters) {
          if ((cScene.filters || []).includes(oFilter.filterName)) {
            scene.addFilter({
              name: oFilter.filterName,
              enabled: oFilter.filterEnabled,
            });
          }
        }
      }

      this.loadState();
      this.dumpState();
    });
  }

  addScene(scene: Scene): Scene {
    this.scenes.set(scene.name, scene);

    return scene;
  }

  getScene(sceneName: string): Scene | null {
    return this.scenes.get(sceneName) || null;
  }

  async getSceneList() {
    return await this.obs.call("GetSceneList");
  }

  async getSceneItemList({ sceneName = process.env.SCENE_NAME }) {
    return await this.obs.call("GetSceneItemList", {
      sceneName: sceneName
    }).then((response: any) => {
      return response.sceneItems;
    });
  }

  async getSceneItemTransform({ sceneName, sceneItemId }: { sceneName: string, sceneItemId: string }) {
    return await this.obs.call("GetSceneItemTransform", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    }).then((transformData: any) => transformData);
  }

  async getSourceFilterList(sourceUuid: string) {
    return await this.obs.call("GetSourceFilterList", {
      sourceUuid: sourceUuid
    }).then((response: any) => response.filters);
  }

  getActions(): Actions {
    return Object.fromEntries(
      this.scenes.values().map((scene: Scene) => [scene.name, scene.getActions()])
    );
  }

  action(action: string, sceneName: string, props: any): void {
    const scene = this.getScene(sceneName);

    if (!scene) {
      console.log("scene not found", sceneName);
      return;
    }

    if (!scene.getSceneItem()) {
      console.error(`Scene '${sceneName}' has no scene item set - its configured gameSource wasn't found as a source in OBS when scenes were loaded (check the controller's 'scenes' config against the actual source names in that OBS scene). Ignoring action '${action}'.`);
      return;
    }

    console.log('action', action, sceneName, props);

    const actionFunc: any = (scene as any)[action];

    if (typeof actionFunc === "function") {
      console.log(`responds to ${action}`, props);
      actionFunc.apply(scene, [props]);
      this.send(scene.name);
      this.dumpState();
    }
  }

  async send(sceneName: string) {
    const scene = this.scenes.get(sceneName);

    if (!scene) {
      throw new Error(`Scene ${sceneName} not found in controller`);
    }

    const commands = scene.getCommands();
    const requests = [];

    for (const cmd of commands) {
      requests.push({
        requestType: cmd.command,
        requestData: cmd.props
      });
    }

    console.log('requests', JSON.stringify(requests, null, 2));
    if (requests.length > 0) {
      await this.obs.callBatch(requests);
    }
  }
}
