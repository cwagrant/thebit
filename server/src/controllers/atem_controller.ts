import { Controller } from "./controller.js"
import { Atem } from 'atem-connection';
// import cfg from "../config.js";
// import { existsSync, readFileSync, writeFileSync } from "node:fs";

export default class ATEMController extends Controller {
  atem: Atem;

  constructor() {
    super();

    this.atem = new Atem();
    this.atem.on('info', console.log);
    this.atem.on('error', console.error);
    this.atem.on('receivedCommands', console.log);
    this.atem.on('connected', () => {
      console.log('ATEM connected');
    });
  }

  connect(ipAddress: string) {
    console.log(`Connecting to ATEM at ${ipAddress}...`);
    
    this.atem.connect(ipAddress);
  }

  start(): boolean {
    return true;
  }

  stop(): boolean {
    return true;
  }

  reset(): boolean {
    return false;
  }
};