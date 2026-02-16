import { now } from "./utils.js";
import { CONFIG } from "./config.js";

export class Clock{
  constructor(){
    this.t = now();
  }
  tick(){
    const n = now();
    const dt = (n - this.t)/1000;
    this.t = n;
    return Math.min(CONFIG.DT_CAP, Math.max(0, dt));
  }
}
