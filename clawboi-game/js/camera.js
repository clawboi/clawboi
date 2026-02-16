import { clamp } from "./utils.js";
import { CONFIG } from "./config.js";

export class Camera{
  constructor(viewW, viewH){
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0; this.y = 0;

    this.worldW = viewW;
    this.worldH = viewH;

    this.shake = 0;
    this.shakeT = 0;
  }

  setWorld(w, h){
    this.worldW = w;
    this.worldH = h;
  }

  kick(str=3, time=0.12){
    this.shake = Math.max(this.shake, str);
    this.shakeT = Math.max(this.shakeT, time);
  }

  update(dt, targetX, targetY){
    const tx = targetX - this.viewW/2;
    const ty = targetY - this.viewH/2;
    this.x = clamp(tx, 0, Math.max(0, this.worldW - this.viewW));
    this.y = clamp(ty, 0, Math.max(0, this.worldH - this.viewH));

    if (this.shakeT > 0){
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.shake = Math.max(0, this.shake - CONFIG.CAM_SHAKE_DECAY * dt);
    } else {
      this.shake = 0;
    }
  }

  getShakeOffset(){
    if (this.shake <= 0) return { sx:0, sy:0 };
    const s = this.shake;
    const sx = (Math.random()*2 - 1) * s;
    const sy = (Math.random()*2 - 1) * s;
    return { sx, sy };
  }
}

