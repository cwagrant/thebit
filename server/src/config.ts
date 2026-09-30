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
  controllerPlugins: Map<string, string>;
  listenerPlugins: Map<string, string>;
  controllers: {
    OBS?: OBSControllerConfig;
    ATEM?: ATEMControllerConfig;
  }
  listeners: ListenerConfig[];
}

let jsConfig: ConfigData;

const configPath = path.join(process.cwd(), "thebit.config.js");

const mod = await import(configPath);
jsConfig = mod.default;

if (!jsConfig) {
  throw new Error('Unable to load thebit.config.js');
}

class Config {
  private configData: ConfigData;

  constructor() {

    if (jsConfig) {
      this.configData = jsConfig;
    } else {
      throw new Error("No config file found. Unable to continue.");
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

  get controllerPlugins() {
    return {
      ...this.defaultControllers,
      ...this.configData.controllerPlugins
    };
  }

  private get defaultControllers() {
    return { "obs": "./controllers/obs_controller.js" };
  }

  get listenerPlugins() {
    return {
      ...this.defaultListeners,
      ...this.configData.listenerPlugins,
    };
  }

  private get defaultListeners() {
    return {
      "socketio": "./listeners/socketio_listener.js",
      "ws": "./listeners/ws_listener.js",
      "twitch-eventsub": "./listeners/twitch_eventsub_listener.js",
      "manual": "./listeners/manual_listener.js"
    };
  }

  getData(): ConfigData {
    return this.configData;
  }
}

export default new Config();
