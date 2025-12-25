import { Controller } from "./controller.js"
import { Scene, SceneItem } from "../obs/index.js"
import ObsWebSocket from "obs-websocket-js";
import cfg from "../config.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Action } from '../action.js';

export default class ObsController extends Controller {
  scenes: Map<string, Scene> = new Map();
  url: string;
  obs: any;
  connectionAttempts: number = 0;
  gameSceneNamePrefix = 'Transform';
  gameSceneItemNamePrefix = 'game';
  password: string | undefined;
  config: any = cfg.controller("OBS")

  constructor(url: string, password?: string) {
    super()

    this.url = url;
    this.password = password;
    this.obs = new ObsWebSocket();
  }

  dumpState(): void {
    const state = Object.fromEntries(this.scenes);

    writeFileSync("../obs_controller.state.json", JSON.stringify(state, null, 2));
  }

  loadState(): void {
    if (!existsSync("../obs_controller.state.json"))
      return

    try {
      const data = readFileSync("../obs_controller.state.json", "utf-8");
      const state = JSON.parse(data.toString())
      for (const [sceneName, sceneState] of Object.entries(state)) {
        const scene = this.getScene(sceneName);
        if (scene) {
          scene.loadState(sceneState);
        }
      }
    } catch (err: any) {
      console.error("Failed to parse state file", err)
    }
  }

  async connect(): Promise<any> {
    this.bindConnectionEvents();
    this.bindStartupEvents();

    return this.obs.connect(this.url, this.password);
  }

  start(): boolean {
    this.active = true

    return this.active
  }

  stop(): boolean {
    this.active = false

    return this.active
  }

  reset(): boolean {
    return false
  }

  bindConnectionEvents(): void {
    this.obs.on("ConnectionError", (err: any) => {
      console.error("OBS Error:", err)
    })

    this.obs.on("ConnectionClosed", () => {
      const intervalTime = this.connectionAttempts * 1000
      const reconnectWait = intervalTime > 10000 ? 10000 : intervalTime

      if (this.connectionAttempts === 1) {
        console.debug('OBS Connection Closed')
      }

      setTimeout(async () => {
        this.connectionAttempts = this.connectionAttempts + 1;
        console.debug(`OBS Reconnection Attempt ${this.connectionAttempts}`)
        try { await this.obs.connect(this.url) } catch { }
      }, reconnectWait);
    });

    this.obs.on("ConnectionOpened", () => {
      this.connectionAttempts = 1;
      console.debug("OBS Connection Opened");
    });
  }

  bindStartupEvents(): void {
    this.obs.once("Identified", async () => {
      const { scenes: obsScenes } = await this.getSceneList();

      for (const cScene of this.config.scenes) {
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

            const transform = oSceneItem.sceneItemTransform
            scene.setSceneItem(new SceneItem({
              name: oSceneItem.sourceName,
              id: oSceneItem.sceneItemId,
              scene: scene,
              active: true,
              defaultPosition: { x: transform.positionX, y: transform.positionY },
              defaultScale: { x: transform.scaleX, y: transform.scaleY },
              defaultSize: { width: transform.width, height: transform.height },
              defaultAlignment: transform.alignment,
              rotation: transform.rotation
            }));
          } else if (cScene.sources.includes(oSceneItem.sourceName)) {
            scene.addSource({
              name: oSceneItem.sourceName,
              enabled: oSceneItem.sceneItemEnabled,
              id: oSceneItem.sceneItemId,
              uuid: oSceneItem.sourceUuid
            })
          }
        }

        const oFilters = await this.getSourceFilterList(scene.uuid)

        for (const oFilter of oFilters) {
          if (cScene.filters.includes(oFilter.filterName)) {
            scene.addFilter({
              name: oFilter.filterName,
              enabled: oFilter.filterEnabled,
            })
          }
        }
        console.debug('scene', scene);
      }

      this.loadState();
      this.dumpState();
    })
  }

  addScene(scene: Scene): Scene {
    this.scenes.set(scene.name, scene)

    return scene;
  }

  getScene(sceneName: string): Scene | null {
    return this.scenes.get(sceneName) || null;
  }

  async getSceneList() {
    return await this.obs.call("GetSceneList")
  }

  async getSceneItemList({ sceneName = process.env.SCENE_NAME }) {
    return await this.obs.call("GetSceneItemList", {
      sceneName: sceneName
    }).then((response: any) => {
      return response.sceneItems;
    })
  }

  async getSceneItemTransform({ sceneName, sceneItemId }: { sceneName: string, sceneItemId: string }) {
    return await this.obs.call("GetSceneItemTransform", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    }).then((transformData: any) => transformData)
  }

  async getSourceFilterList(sourceUuid: string) {
    return await this.obs.call("GetSourceFilterList", {
      sourceUuid: sourceUuid
    }).then((response: any) => response.filters)
  }

  getActions(): Map<string, Action[]> {
    const actions = new Map<string, Action[]>(
      this.scenes.values().map((scene: Scene) => [scene.name, scene.getActions()])
    )

    return actions;
  }

  action(action: string, sceneName: string, props: any): void {
    const scene = this.getScene(sceneName);

    if (!scene)
      return

    console.log('action', action, sceneName, props)

    const actionFunc: any = (scene as any)[action];

    if (typeof actionFunc === "function") {
      console.log(`responds to ${action}`, props)
      actionFunc.apply(scene, [props]);
      this.send(scene.name);
    }
  }

  async send(sceneName: string) {
    const scene = this.scenes.get(sceneName);

    if (!scene) {
      throw new Error(`Scene ${sceneName} not found in controller`)
    }

    const commands = scene.getCommands();
    let requests = [];

    for (let cmd of commands) {
      requests.push({
        requestType: cmd.command,
        requestData: cmd.props
      })
    }

    console.log('requests', JSON.stringify(requests, null, 2));
    if (requests.length > 0) {
      await this.obs.callBatch(requests);
    }
  }
}
