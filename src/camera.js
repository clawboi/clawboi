import { clamp } from "./utils.js";

export class Camera {
  constructor({ viewW, viewH, worldW, worldH }){
    this.viewW = viewW;
    this.viewH = viewH;
    this.worldW = worldW;
    this.worldH = worldH;

    this.x = 0;
    this.y = 0;

    this.shake = 0;
    this.shakeT = 0;
  }

  resizeView(viewW, viewH){
    this.viewW = viewW;
    this.viewH = viewH;
  }

  setWorld(worldW, worldH){
    this.worldW = worldW;
    this.worldH = worldH;
  }

  kick(power=3, time=0.12){
    this.shake = Math.max(this.shake, power);
    this.shakeT = Math.max(this.shakeT, time);
  }

  update(dt, targetX, targetY){
    const tx = targetX - this.viewW/2;
    const ty = targetY - this.viewH/2;

    // smooth follow
    this.x += (tx - this.x) * (1 - Math.pow(0.001, dt));
    this.y += (ty - this.y) * (1 - Math.pow(0.001, dt));

    // clamp to world
    this.x = clamp(this.x, 0, Math.max(0, this.worldW - this.viewW));
    this.y = clamp(this.y, 0, Math.max(0, this.worldH - this.viewH));

    if(this.shakeT > 0){
      this.shakeT -= dt;
      this.shake *= 0.86;
      if(this.shakeT <= 0) this.shake = 0;
    }
  }

  getShakeOffset(){
    if(this.shake <= 0) return { sx:0, sy:0 };
    const sx = (Math.random()*2-1) * this.shake * 0.7;
    const sy = (Math.random()*2-1) * this.shake * 0.7;
    return { sx, sy };
  }
}

