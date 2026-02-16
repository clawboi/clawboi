import { clamp } from "./utils.js";

export class DropManager {
  constructor(){
    this.list = [];
    this.t = 0;
  }

  reset(){
    this.list.length = 0;
    this.t = 0;
  }

  // violet essence: heal + xp
  spawnEssence(x,y, amount=6){
    for(let i=0;i<amount;i++){
      this.list.push({
        kind:"essence",
        x: x + (Math.random()*2-1)*10,
        y: y + (Math.random()*2-1)*10,
        vx: (Math.random()*2-1)*40,
        vy: (Math.random()*2-1)*40,
        r: 4,
        on: true,
        a: 0.95
      });
    }
    if(this.list.length>220) this.list.splice(0, this.list.length-220);
  }

  update(dt, world){
    this.t += dt;
    for(const d of this.list){
      if(!d.on) continue;
      d.vx *= Math.pow(0.001, dt*2.5);
      d.vy *= Math.pow(0.001, dt*2.5);

      const nx = d.x + d.vx*dt;
      if(!world.isBlockedCircle(nx, d.y, d.r)) d.x = nx;
      const ny = d.y + d.vy*dt;
      if(!world.isBlockedCircle(d.x, ny, d.r)) d.y = ny;

      d.a *= 0.999;
    }
  }

  tryCollect(player){
    let got = 0;
    for(const d of this.list){
      if(!d.on) continue;
      const dist = Math.hypot(player.x-d.x, player.y-d.y);
      if(dist < player.r + d.r + 3){
        d.on = false;
        got++;
      }
    }
    return got;
  }

  draw(ctx, camX, camY){
    const pulse = 0.5 + 0.5*Math.sin(this.t*6.2);
    for(const d of this.list){
      if(!d.on) continue;
      const x = (d.x - camX)|0;
      const y = (d.y - camY)|0;

      ctx.fillStyle = `rgba(138,46,255,${0.30 + pulse*0.25})`;
      ctx.fillRect(x-3, y-3, 6, 6);

      ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse*0.25})`;
      ctx.fillRect(x-1, y-1, 2, 2);
    }
  }
}

