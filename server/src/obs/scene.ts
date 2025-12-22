import { ObsCommand, SceneItem } from "./scene_item.js"

interface Item {
  name: string,
  enabled: boolean,
  id?: number,
  uuid?: string
}

class Scene {
  name: string;
  sceneItem!: SceneItem;
  filters: Map<string, Item> = new Map();
  sources: Map<string, Item> = new Map();
  commands: ObsCommand[] = [];
  uuid: string;

  constructor(props: { name: string, uuid: string }) {
    this.name = props.name;
    this.uuid = props.uuid;
  }

  setSceneItem(sceneItem: SceneItem): SceneItem {
    this.sceneItem = sceneItem;

    return this.sceneItem;
  }

  getSceneItem(): SceneItem {
    return this.sceneItem;
  }

  addSource(props: Item): void {
    this.sources.set(props.name, props);
  }

  getSource(sourceName: string): Promise<Item> {
    const source = this.sources.get(sourceName);

    return new Promise((resolve, reject) => {
      if (source) {
        resolve(source);
      } else {
        reject(new Error(`No source found with name ${sourceName}`));
      }
    })
  }

  addFilter(props: Item): void {
    this.filters.set(props.name, props)
  }

  getFilter(filterName: string): Promise<Item> {
    const filter = this.filters.get(filterName);

    return new Promise((resolve, reject) => {
      if (filter) {
        resolve(filter);
      } else {
        reject(new Error(`No filter found with name ${filterName}`));
      }
    })
  }

  getCommands(): Array<ObsCommand> {
    const commands = this.commands.splice(0, this.commands.length);

    return [...commands, ...this.sceneItem.getCommands()];
  }

  reset(): void {
    this.sceneItem.reset();

    this.sources.values().forEach((source: Item) => {
      source.enabled = false;

      this.commands.push({
        command: "SetSceneItemEnabled",
        props: {
          sceneName: source.name,
          sceneItemId: source.id,
          sceneItemEnabled: source.enabled
        }
      })
    })

    this.filters.values().forEach((filter: Item) => {
      this.commands.push({
        command: "SetSourceFilterEnabled",
        props: {
          sourceName: this.name,
          filterName: filter.name,
          filterEnabled: filter.enabled
        }
      })
    })
  }

  source(sourceName: string): void {
    this.getSource(sourceName).then((source) => {
      source.enabled = !source.enabled;

      this.commands.push({
        command: "SetSceneItemEnabled",
        props: {
          sceneName: source.name,
          sceneItemId: source.id,
          sceneItemEnabled: source.enabled
        }
      })
    });
  }

  filter(filterName: string): void {
    this.getFilter(filterName).then((filter) => {
      filter.enabled = !filter.enabled

      this.commands.push({
        command: "SetSourceFilterEnabled",
        props: {
          sourceName: this.name,
          filterName: filter.name,
          filterEnabled: filter.enabled
        }
      })
    })
  }
}

export { Scene }






