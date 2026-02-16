import { clamp } from "./utils.js";

export class PickupManager {
  constructor(){
    this.list = [];
    this.collected = 0;
    this.target = 3;

    // little sparkle anim
    this.t = 0;
  }

  reset(target=3){
    this.list.length = 0;
    this.collected = 0;
    this.target = target;
    this.t = 0;
  }

  addShard(x, y){
    this.list.push({ kind:"shard", x, y, r:8, on:true });
  }

  update(dt){
    this.t += dt;
  }

  tryCollect(player){
    let got = 0;
    for(const p of this.list){
      if(!p.on) continue;
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if(d < (player.r + p.r + 2)){
        p.on = false;
        got++;
      }
    }
    if(got){
      this.collected += got;
    }
    return got;
  }

  done(){
    return this.collected >= this.target;
  }

  draw(ctx, camX, camY){
    const pulse = 0.5 + 0.5*Math.sin(this.t*5.2);
    for(const p of this.list){
      if(!p.on) continue;
      const x = (p.x - camX) | 0;
      const y = (p.y - camY) | 0;

      // glow
      ctx.fillStyle = `rgba(138,46,255,${0.20 + pulse*0.25})`;
      ctx.fillRect(x-6, y-6, 12, 12);

      // core crystal
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(x-1, y-4, 2, 8);
      ctx.fillStyle = "rgba(138,46,255,0.95)";
      ctx.fillRect(x-3, y-2, 1, 4);
      ctx.fillRect(x+2, y-2, 1, 4);

      // spark pixel
      if(((x+y) & 7) === 0){
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x+4, y-5, 1, 1);
      }
    }
  }
}

