import { dist2, clamp } from "./utils.js";

export class EnemyManager{
  constructor(world){
    this.world = world;
    this.list = [];
  }

  reset(){
    this.list.length = 0;
  }

  alive(){
    return this.list.length;
  }

  spawnWave(px, py, count=6){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const d = 70 + Math.random()*80;
      const x = px + Math.cos(a)*d;
      const y = py + Math.sin(a)*d;

      this.list.push({
        x, y,
        r: 6,
        hp: 18,
        spd: 32 + Math.random()*14,
        hurtT: 0
      });
    }
  }

  update(dt, player){
    const w = this.world;

    for (const e of this.list){
      e.hurtT = Math.max(0, e.hurtT - dt);

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const m = Math.hypot(dx, dy) || 1;

      const vx = (dx/m) * e.spd;
      const vy = (dy/m) * e.spd;

      const nx = e.x + vx*dt;
      const ny = e.y + vy*dt;

      const safe = w.tryMoveCircle(e.x, e.y, nx, ny, e.r);
      e.x = safe.x;
      e.y = safe.y;

      e.x = clamp(e.x, e.r, w.worldW - e.r);
      e.y = clamp(e.y, e.r, w.worldH - e.r);

      // contact damage
      const rr = (player.r + e.r);
      if (dist2(player.x, player.y, e.x, e.y) <= rr*rr){
        player.hp -= 14*dt; // mild constant
      }
    }

    // remove dead
    this.list = this.list.filter(e => e.hp > 0);
  }

  hits(hitbox){
    // returns number of kills
    let kills = 0;
    const hbR2 = hitbox.r * hitbox.r;

    for (const e of this.list){
      const d = dist2(hitbox.x, hitbox.y, e.x, e.y);
      if (d <= hbR2){
        e.hp -= hitbox.dmg || 10;
        e.hurtT = 0.12;
        if (e.hp <= 0) kills++;
      }
    }
    return kills;
  }

  draw(ctx, camX, camY){
    for (const e of this.list){
      const x = (e.x - camX)|0;
      const y = (e.y - camY)|0;

      ctx.fillStyle = e.hurtT > 0 ? "rgba(255,74,122,0.9)" : "rgba(255,255,255,0.82)";
      ctx.beginPath();
      ctx.arc(x, y, e.r, 0, Math.PI*2);
      ctx.fill();
    }
  }
}
