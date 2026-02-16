import { lerp } from "./utils.js";

export class Profiler{
  constructor(){
    this.fps = 0;
    this._fpsS = 0;
  }
  tick(dt){
    const fps = dt > 0 ? (1/dt) : 0;
    this._fpsS = this._fpsS ? lerp(this._fpsS, fps, 0.08) : fps;
    this.fps = (this._fpsS|0);
  }
}
