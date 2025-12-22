import "dotenv/config";
import OBSWebSocket from "obs-websocket-js";
import ObsTransformer from "./obs_transformer.js";
import { sleep } from "./helpers.js";

export default class ObsController {
  gameSceneNames = ['TransformGame1', 'TransformGame2']
  gameSceneItemNames = ['game1', 'game2'];
  gameSceneNamePrefix = 'Transform';
  gameSceneItemNamePrefix = 'game';

  constructor(url) {
    this.url = url;
    this.obs = new OBSWebSocket();
    this.connectionAttempts = 0;
    this.scenes = []
    this.sceneItems = [];
    this.transformers = {}
  }

  async connect() {
    this.bindConnectionEvents()
    this.bindOnStartup();
    console.log(`Connecting to OBS WebSocket: ${this.url}`)
    try {
      await this.obs.connect(this.url);
    } catch { }
  }

  bindOnStartup() {
    this.obs.once("Identified", async () => {
      const { scenes } = await this.getSceneList();

      for (const scene of scenes) {
        if (!scene.sceneName.startsWith(this.gameSceneNamePrefix)) {
          continue;
        }

        scene.sceneItems = await this.getSceneItemList({
          sceneName: scene.sceneName
        });

        scene.sceneItems ||= [];

        for (const sceneItem of scene.sceneItems) {
          if (!sceneItem.sourceName.startsWith(this.gameSceneItemNamePrefix)) {
            continue
          }
          const { height, width, scaleX } = sceneItem.sceneItemTransform;

          sceneItem.transformer = new ObsTransformer(
            height,
            width,
            scaleX
          )
        }
      }

      this.scenes = scenes;
    })
  }

  bindConnectionEvents() {
    this.obs.on("ConnectionError", (err) => {
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

  // async connect() {
  //   console.log(
  //     "Attempting to connect to OBS at:",
  //     process.env.OBS_WEBSOCKET_ADDRESS,
  //   );
  //
  //   await this.connectToOBS();
  //   console.log('Connected to OBS WebSocket')
  // }

  async getSceneItemList({ sceneName = process.env.SCENE_NAME }) {
    return await this.obs.call("GetSceneItemList", {
      sceneName: sceneName
    }).then((response) => {
      return response.sceneItems;
    })
  }

  async getSceneItemId({ sceneName, sourceName }) {
    return this.obs.call("GetSceneItemId", {
      sceneName: sceneName,
      sourceName: sourceName
    }).then((result) => result.sceneItemId)
  }

  async getSceneItemTransform({ sceneName, sceneItemId }) {
    return await this.obs.call("GetSceneItemTransform", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    }).then((transformData) => transformData)
  }

  findSceneItemIdByName({ sceneName, itemName }) {
    return this.scenes[sceneName].find((item) => item.sourceName === itemName)?.sceneItemId
  }

  async setSceneItemEnabled({ sourceName = process.env.SCENE_NAME, sceneItemName, enabled }) {
    return await this.obs.call("SetSceneItemEnabled", {
      sceneName: sourceName,
      sceneItemId: this.findSceneItemIdByName({ sceneName: sourceName, itemName: sceneItemName }),
      sceneItemEnabled: !!enabled
    })
  }

  async setSourceFilterEnabled({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, enabled }) {
    return await this.obs.call("SetSourceFilterEnabled", {
      sourceName: sourceName,
      filterName: filterName,
      filterEnabled: !!enabled
    })
  }

  async setSourceFilterSettings({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, settings }) {
    return await this.obs.call("SetSourceFilterSettings", {
      sourceName: sourceName,
      filterName: filterName,
      filterSettings: settings
    });
  }

  async batchDisable({ sceneName }) {
    const sceneItemIds = this.scenes[sceneName]
      .filter(item => item.sourceName != "minish")
      .map((item) => item.sceneItemId);

    let requests = []
    for (const sceneItemId of sceneItemIds) {
      requests.push({
        requestType: 'SetSceneItemEnabled',
        requestData: {
          sceneName: sceneName,
          sceneItemId: sceneItemId,
          sceneItemEnabled: false
        }
      })
    }

    for (const filterName of ["delay", "invert", "spin"]) {
      requests.push({
        requestType: "SetSourceFilterEnabled",
        requestData: {
          sourceName: sceneName,
          filterName: filterName,
          filterEnabled: false
        }
      })
    }

    return await this.obs.callBatch(requests)
  }

  async getSourceFilter({ sourceName, filterName }) {
    return await this.obs.call("GetSourceFilter", {
      sourceName: sourceName,
      filterName: filterName
    })
  }

  async getSceneItemEnabled({ sceneName, sceneItemName }) {
    const sceneItemId = this.findSceneItemIdByName({ sceneName, itemName: sceneItemName });

    return await this.obs.call("GetSceneItemEnabled", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    })
  }

  async getSceneList() {
    return await this.obs.call("GetSceneList")
  }

  getSceneItemByName({ sceneName, sceneItemName }) {
    const scene = this.getScene({ sceneName: sceneName })

    return scene.sceneItems.find((item) => item.sourceName === sceneItemName)
  }

  getScene({ sceneName }) {
    return this.scenes.find((scene) => scene.sceneName === sceneName)
  }

  async runTransform({ sourceName, transform }) {
    await this.obs.callBatch([
      {
        requestType: 'SetSourceFilterSettings',
        requestData: {
          sourceName: sourceName,
          filterName: 'transform',
          filterSettings: transform
        }
      },
      {
        requestType: 'SetSourceFilterEnabled',
        requestData: {
          sourceName: sourceName,
          filterName: 'transform',
          filterEnabled: true
        }
      }
    ])
  }

  async scaleScene({ sceneName, sceneItemName }, cb) {
    const sceneItem = this.getSceneItemByName({
      sceneName: sceneName,
      sceneItemName: sceneItemName
    })

    const transform = cb(sceneItem)

    await this.runTransform({ sourceName: sceneName, transform: transform });
  }

  async rotateScene({ sceneName, sceneItemName }, cb) {
    const sceneItem = this.getSceneItemByName(
      {
        sceneName: sceneName,
        sceneItemName: sceneItemName
      })

    const transform = cb(sceneItem)

    await this.runTransform({ sourceName: sceneName, transform: transform });
  }

  async shrink({ sceneName, sceneItemName }) {
    this.scaleScene({ sceneName: sceneName, sceneItemName: sceneItemName }, (sceneItem) => {
      const { currentScale } = sceneItem.transformer

      return sceneItem.transformer.scale(currentScale - 0.1)
    })
  }

  async grow({ sceneName, sceneItemName }) {
    this.scaleScene({ sceneName: sceneName, sceneItemName: sceneItemName }, (sceneItem) => {
      const { currentScale } = sceneItem.transformer

      return sceneItem.transformer.scale(currentScale + 0.1)
    })
  }

  async rotate90({ sceneName, sceneItemName }) {
    this.rotateScene({ sceneName: sceneName, sceneItemName: sceneItemName }, (sceneItem) => {
      return sceneItem.transformer.rotate(90)
    })
  }

  async rotate180({ sceneName, sceneItemName }) {
    this.rotateScene({ sceneName: sceneName, sceneItemName: sceneItemName }, (sceneItem) => {
      return sceneItem.transformer.rotate(180)
    })
  }

  async rotate({ sceneName, sceneItemName }) {
    this.rotateScene({ sceneName: sceneName, sceneItemName: sceneItemName }, (sceneItem) => {
      const { angle } = sceneItem.transformer;

      return sceneItem.transformer.rotate(angle + 15);
    })
  }

  async toggleSceneItem({ sceneName }) {
    const { sceneItemEnabled } = await obs.getSceneItemEnabled({
      sceneName: sceneName,
      sceneItemName: 'dvd',
    })

    obs.setSceneItemEnabled({
      sceneName: sceneName,
      sceneItemName: 'dvd',
      enabled: !sceneItemEnabled
    })
  }

  triggerHotkey() {
    this.obs.call("TriggerHotkeyByName", {
      hotkeyName: process.env.HOTKEY_NAME,
    }).then().catch((e) => console.log(e));
  }
}
