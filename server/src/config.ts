import * as path from 'path';

interface OBSControllerConfig {
  scenes: SceneConfig[];
}

interface SceneConfig {
  name: string;
  gameSource: string;
  moveTransitionFilterName: string;
  filters: string[];
  sources: string[];
}

interface ATEMControllerConfig {

}

interface ConfigData {
  controllers: {
    OBS?: OBSControllerConfig;
    ATEM?: ATEMControllerConfig;
  }
  listeners: ListenerConfig[];
}

let jsConfig: ConfigData;

const configPath = path.join(
  import.meta.dirname, "..", "..", "thebit.config.js"
)

const mod = await import(configPath)
jsConfig = mod.default;

console.log('Unable to load thebit.config.js')

class Config {
  private configData: ConfigData;

  constructor() {

    if (jsConfig) {
      this.configData = jsConfig;
    } else {
      throw new Error("No config file found. Unable to continue.")
    }

    if (this.configData) {
      if (Object.keys(this.configData.controllers).length === 0) {
        throw new Error("No controllers defined in configuration file");
      }
    }
  }

  controller<Key extends keyof ConfigData['controllers']>(name: Key): ConfigData['controllers'][Key] | undefined {
    return this.configData.controllers[name];
  }

  get controllers() {
    return Object.keys(this.configData.controllers);
  }

  get listeners() {
    return this.configData.listeners;
  }

  getData(): ConfigData {
    return this.configData;
  }
}

export default new Config();
