import "dotenv/config";

export default class ObsController {
  constructor(obs) {
    this.obs = obs;
    this.active = false;
    this.scenes = {}
  }

  getSceneItemList({ sceneName = process.env.SCENE_NAME }) {
    this.obs.call("GetSceneItemList", {
      sceneName: sceneName
    }).then((response) => {
      this.scenes[sceneName] = response.sceneItems;
    })
  }

  findSceneItemIdByName({ sceneName, itemName }) {
    const id = this.scenes[sceneName].find((item) => item.sourceName === itemName)?.sceneItemId

    console.log('stuff', id, sceneName, itemName)
    return id
  }

  setSceneItemEnabled({ sourceName = process.env.SCENE_NAME, sceneItemName, enabled }) {
    this.obs.call("SetSceneItemEnabled", {
      sceneName: sourceName,
      sceneItemId: this.findSceneItemIdByName({ sceneName: sourceName, itemName: sceneItemName }),
      sceneItemEnabled: !!enabled
    })
  }

  setSourceFilterEnabled({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, enabled }) {
    this.obs.call("SetSourceFilterEnabled", {
      sourceName: sourceName,
      filterName: filterName,
      filterEnabled: !!enabled
    })
  }

  setSourceFilterSettings({ sourceName = process.env.SCENE_NAME, filterName = process.env.FILTER_NAME, settings }) {
    console.debug("sourceName", sourceName, "filterName", filterName, "filterSettings", settings)
    this.obs.call("SetSourceFilterSettings", {
      sourceName: sourceName,
      filterName: filterName,
      filterSettings: settings
    });
  }

  triggerHotkey() {
    this.obs.call("TriggerHotkeyByName", {
      hotkeyName: process.env.HOTKEY_NAME,
    }).then().catch((e) => console.log(e));
  }
}
