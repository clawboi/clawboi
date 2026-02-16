import { CONFIG } from "./config.js";
import { now } from "./utils.js";

export class Clock{
  constructor(){
    this.last = now();
  }
  tick(){
    const t = now();
    const dt = (t - this.last) / 1000;
    this.last = t;
    return Math.min(CONFIG.DT_CAP, Math.max(0, dt));
  }
}

