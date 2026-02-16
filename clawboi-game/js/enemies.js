import { dist2, rand, randi, clamp } from "./utils.js";

function segCircle(x1,y1,x2,y2,cx,cy,r){
  // segment-circle collision
  const dx = x2-x1, dy = y2-y1;
  const l2 = dx*dx + dy*dy;
  if (l2 === 0) return ((cx-x1)**2 + (cy-y1)**2) <= r*r;

  let t = ((cx-x1)*dx + (cy-y1)*dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t*dx;
  const py = y1 + t*dy;
  const ddx = cx - px, ddy = cy - py;
  return (ddx*ddx + ddy*ddy) <= r*r;
}

export class EnemyManager{
  constructor(world){
    this.world = world;
    this.enemies = [];
    this.wave = 0;
  }

  reset(){
    this.enemies.length = 0;
    this.wave = 0;
  }

  aliveCount(){
    let n=0;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  }

  spawnWaveAround(px, py, level=1){
    this.wave++;
    const count = Math.min(18, 4 + this.wave + Math.floor(level*0.7));

    for (let i=0;i<count;i++){
      let tries = 0;
      while (tries++ < 200){
        const a = Math.random()*Math.PI*2;
        const d = 90 + Math.random()*140;
        const x = px + Math.cos(a)*d;
        const y = py + Math.sin(a)*d;
        if (!this.world.isBlockedCircle(x,y,6)){
          this.enemies.push({
            x,y, r:6,
            hp: 18 + this.wave*4 + level*4,
            spd: 32 + this.wave*1.3,
            kbX:0, kbY:0,
            atkCd: rand(0.3, 1.0),
            dead:false,
          });
          break;
        }
      }
    }
  }

  update(dt, player){
    for (const e of this.enemies){
      if (e.dead) continue;

      // knockback decay
      e.kbX *= (1 - 8*dt);
      e.kbY *= (1 - 8*dt);

      // chase player
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const m = Math.hypot(dx,dy) || 1;

      const vx = (dx/m) * e.spd + e.kbX;
      const vy = (dy/m) * e.spd + e.kbY;

      const nx = e.x + vx*dt;
      const ny = e.y + vy*dt;

      if (!this.world.isBlockedCircle(nx, e.y, e.r)) e.x = nx;
      if (!this.world.isBlockedCircle(e.x, ny, e.r)) e.y = ny;

      // attack player if close
      e.atkCd = Math.max(0, e.atkCd - dt);
      const rr = (player.r + e.r + 1);
      if (e.atkCd<=0 && (dx*dx + dy*dy) <= rr*rr){
        e.atkCd = 0.65;
        player.hurt(6);
      }
    }

    // cleanup dead
    this.enemies = this.enemies.filter(e=>!e.dead || e._t>0);
  }

  // returns {count,kills}
  resolvePlayerAttack(player, hb){
    let count=0, kills=0;

    for (const e of this.enemies){
      if (e.dead) continue;

      let hit = false;

      if (hb.type === "circle"){
        const rr = (e.r + hb.r);
        if (dist2(e.x,e.y,hb.x,hb.y) <= rr*rr) hit = true;
      } else if (hb.type === "ray"){
        if (segCircle(hb.x1,hb.y1,hb.x2,hb.y2, e.x,e.y, e.r+2)) hit = true;
      }

      if (hit){
        count++;
        e.hp -= hb.dmg;

        // knockback away from player
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const m = Math.hypot(dx,dy) || 1;
        e.kbX += (dx/m) * (hb.kb/60);
        e.kbY += (dy/m) * (hb.kb/60);

        if (e.hp <= 0){
          e.dead = true;
          kills++;
        }
      }
    }

    return { count, kills };
  }

  draw(ctx, camX, camY){
    for (const e of this.enemies){
      if (e.dead) continue;

      const x = (e.x - camX)|0;
      const y = (e.y - camY)|0;

      // body
      ctx.fillStyle = "rgba(255,74,122,0.92)";
      ctx.fillRect(x-3,y-3,6,6);

      // tiny hp pip
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(x-3,y-6,6,2);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(x-3,y-6, Math.max(1, Math.min(6, (e.hp/60)*6)), 2);
    }
  }
}

