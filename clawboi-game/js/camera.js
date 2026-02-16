import { clamp } from "./utils.js";

export class Camera{
  constructor(viewW, viewH){
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;
    this.worldW = viewW;
    this.worldH = viewH;

    this.shakeT = 0;
    this.shakeS = 0;
  }

  setWorld(w, h){
    this.worldW = w;
    this.worldH = h;
  }

  kick(str=2, time=0.08){
    this.shakeS = Math.max(this.shakeS, str);
    this.shakeT = Math.max(this.shakeT, time);
  }

  getShake(){
    if (this.shakeT <= 0) return { sx:0, sy:0 };
    const a = (Math.random()*2 - 1) * this.shakeS;
    const b = (Math.random()*2 - 1) * this.shakeS;
    return { sx:a|0, sy:b|0 };
  }

  update(dt, targetX, targetY){
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakeS = 0;

    const tx = targetX - this.viewW/2;
    const ty = targetY - this.viewH/2;

    this.x = clamp(tx, 0, Math.max(0, this.worldW - this.viewW));
    this.y = clamp(ty, 0, Math.max(0, this.worldH - this.viewH));
  }
}
