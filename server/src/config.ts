import * as fs from 'fs';
import * as path from 'path';

interface ControllerConfig {
  scenes: SceneConfig[];
}

interface SceneConfig {
  name: string;
  gameSource: string;
  moveTransitionFilterName: string;
  filters: string[];
  sources: string[];
}

interface ConfigData {
  controllers: Map<string, ControllerConfig>;
}

class Config {
  private configData: ConfigData;

  constructor(configPath: string = path.join(import.meta.dirname, '../../config.json')) {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    this.configData = JSON.parse(rawData);
    this.configData.controllers = new Map(Object.entries(this.configData.controllers));
  }

  controller(name: string): ControllerConfig | undefined {
    return this.configData.controllers.get(name);
  }

  getData(): ConfigData {
    return this.configData;
  }
}

export default new Config();
