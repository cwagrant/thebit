import * as fs from 'fs';
import * as path from 'path';
import { parse } from "yaml";

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

class Config {
  private configData: ConfigData;

  constructor(configPath: string = path.join(import.meta.dirname, '../../config.yaml')) {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    this.configData = parse(rawData);

    if (Object.keys(this.configData.controllers).length === 0) {
      throw new Error("No controllers defined in configuration file");
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
