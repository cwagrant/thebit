import "dotenv/config";
import OBSWebSocket from "obs-websocket-js";
import { sleep } from "./helpers.js";

export default class Obs {
  constructor() {
    this.obs = null
    this.scenes = {}
  }

  async connect() {
    console.log(
      "Attempting to connect to OBS at:",
      process.env.OBS_WEBSOCKET_ADDRESS,
    );

    await this.connectToOBS();
    console.log('Connected to OBS WebSocket')
  }

  connected() {
    return this.obs?.socket != undefined
  }

  async testConnected() {
    try {
      await this.obs.reidentify({});
    } catch (e) {
      await this.connect()
    }
  }

  async connectToOBS(retries = 0) {
    const obs = new OBSWebSocket();

    try {
      await obs.connect(process.env.OBS_WEBSOCKET_ADDRESS);
      this.obs = obs;
    } catch {
      console.log('Failed to connect to OBS. Retrying...')
      retries = retries + 1
      const waitTime = retries * 2000
      await sleep((waitTime >= 10000) ? 10000 : waitTime);
      await this.connectToOBS(retries)
    }
  }

  async getSceneItemList({ sceneName = process.env.SCENE_NAME }) {
    await this.testConnected()
    return await this.obs.call("GetSceneItemList", {
      sceneName: sceneName
    }).then((response) => {
      this.scenes[sceneName] = response.sceneItems;
    })
  }

  async getSceneItemId({ sceneName, sourceName }) {
    await this.testConnected()
    return this.obs.call("GetSceneItemId", {
      sceneName: sceneName,
      sourceName: sourceName
    }).then((result) => result.sceneItemId)
  }

  async getSceneItemTransform({ sceneName, sceneItemId }) {
    await this.testConnected()
    return await this.obs.call("GetSceneItemTransform", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    }).then((transformData) => transformData)
  }

  findSceneItemIdByName({ sceneName, itemName }) {
    return this.scenes[sceneName].find((item) => item.sourceName === itemName)?.sceneItemId
  }

  async setSceneItemEnabled({ sourceName = process.env.SCENE_NAME, sceneItemName, enabled }) {
    await this.testConnected()
    return await this.obs.call("SetSceneItemEnabled", {
      sceneName: sourceName,
      sceneItemId: this.findSceneItemIdByName({ sceneName: sourceName, itemName: sceneItemName }),
      sceneItemEnabled: !!enabled
    })
  }

  async setSourceFilterEnabled({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, enabled }) {
    await this.testConnected()
    return await this.obs.call("SetSourceFilterEnabled", {
      sourceName: sourceName,
      filterName: filterName,
      filterEnabled: !!enabled
    })
  }

  async setSourceFilterSettings({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, settings }) {
    await this.testConnected()
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
    await this.testConnected()

    return await this.obs.call("GetSourceFilter", {
      sourceName: sourceName,
      filterName: filterName
    })
  }

  async getSceneItemEnabled({ sceneName, sceneItemName }) {
    await this.testConnected()
    const sceneItemId = this.findSceneItemIdByName({ sceneName, itemName: sceneItemName });

    return await this.obs.call("GetSceneItemEnabled", {
      sceneName: sceneName,
      sceneItemId: sceneItemId
    })
  }

  triggerHotkey() {
    this.obs.call("TriggerHotkeyByName", {
      hotkeyName: process.env.HOTKEY_NAME,
    }).then().catch((e) => console.log(e));
  }
}
