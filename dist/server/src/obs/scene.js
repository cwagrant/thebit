class Scene {
    name;
    sceneItem;
    filters = new Map();
    sources = new Map();
    commands = [];
    uuid;
    constructor(props) {
        this.name = props.name;
        this.uuid = props.uuid;
    }
    setSceneItem(sceneItem) {
        this.sceneItem = sceneItem;
        return this.sceneItem;
    }
    getSceneItem() {
        return this.sceneItem;
    }
    addSource(props) {
        this.sources.set(props.name, props);
    }
    getSource(sourceName) {
        const source = this.sources.get(sourceName);
        return new Promise((resolve, reject) => {
            if (source) {
                resolve(source);
            }
            else {
                reject(new Error(`No source found with name ${sourceName}`));
            }
        });
    }
    addFilter(props) {
        this.filters.set(props.name, props);
    }
    getFilter(filterName) {
        const filter = this.filters.get(filterName);
        return new Promise((resolve, reject) => {
            if (filter) {
                resolve(filter);
            }
            else {
                reject(new Error(`No filter found with name ${filterName}`));
            }
        });
    }
    getCommands() {
        const commands = this.commands.splice(0, this.commands.length);
        return [...commands, ...this.sceneItem.getCommands()];
    }
    reset() {
        this.sceneItem.reset();
        this.sources.values().forEach((source) => {
            source.enabled = false;
            this.commands.push({
                command: "SetSceneItemEnabled",
                props: {
                    sceneName: source.name,
                    sceneItemId: source.id,
                    sceneItemEnabled: source.enabled
                }
            });
        });
        this.filters.values().forEach((filter) => {
            this.commands.push({
                command: "SetSourceFilterEnabled",
                props: {
                    sourceName: this.name,
                    filterName: filter.name,
                    filterEnabled: filter.enabled
                }
            });
        });
    }
    source(sourceName) {
        this.getSource(sourceName).then((source) => {
            source.enabled = !source.enabled;
            this.commands.push({
                command: "SetSceneItemEnabled",
                props: {
                    sceneName: source.name,
                    sceneItemId: source.id,
                    sceneItemEnabled: source.enabled
                }
            });
        });
    }
    filter(filterName) {
        this.getFilter(filterName).then((filter) => {
            filter.enabled = !filter.enabled;
            this.commands.push({
                command: "SetSourceFilterEnabled",
                props: {
                    sourceName: this.name,
                    filterName: filter.name,
                    filterEnabled: filter.enabled
                }
            });
        });
    }
}
export { Scene };
