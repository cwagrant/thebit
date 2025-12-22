import "dotenv/config";

export default class MultiController {
  gameSceneItems = ['game1', 'game2']

  constructor(obs, commandClient) {
    this.obs = obs;
    this.commandClient = commandClient;
    this.scenes = [];
    this.transformers = {};
  }

  async setup() {
    this.scenes = await this.obs.getSceneItemList({
      sceneName: process.env.SCENE_NAME
    });

    for (const sceneItem in this.gameSceneItems) {
      const { height, width, scale } = sceneItem.sceneItemTransform;

      this.transformers[sceneItem.sourceName] = new ObsTransformer(
        height,
        width,
        scale
      )
    }
  }

  getSceneItemByName({ sceneName, sceneItemName }) {
    this.getScene({ sceneName: sceneName })
      .sceneItems.find((item) => item.sourceName === sceneItemName)
  }

  getScene({ sceneName }) {
    this.scenes.find((scene) => scene.sceneName === sceneName)
  }

  scale({ sceneName, sceneItemName, scale }) {
    const sceneItem = this.getSceneItemByName({ sceneName, sceneItemName })

    sceneItem.transformer.scale(scale);
  }

  small({ sourceName }) {
    this.obs.setSourceFilterSettings({
      settings: this.transformers[sceneName].scale(0.3333)
    })
  }

  large({ sourceName }) {
    this.obs.setSourceFilterSettings({

      settings: this.transformers[sceneName].scale(0.3333)
    })
  }

  shrink({ sceneName }) {
    const scale = t
  }
}
