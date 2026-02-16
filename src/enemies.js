import { clamp, rand, rint } from "./utils.js";

/* EnemyManager:
   - simple AI chase
   - collision with world tiles
   - hit + knockback
   - spawns waves + mini-boss
*/

export class EnemyManager {
  constructor(world){
    this.world = world;
    this.list = [];
    this.spawnT = 0;
    this.wave = 1;
    this.bossSpawned = false;
  }

  reset(){
    this.list.length = 0;
    this.spawnT = 0;
    this.wave = 1;
    this.bossSpawned = false;
  }

  aliveCount(){
    let n=0;
    for(const e of this.list) if(e.hp>0) n++;
    return n;
  }

  spawnWaveAround(px, py, level=1){
    const count = Math.min(10, 2 + ((level*0.7)|0));
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const d = 80 + Math.random()*120;
      const x = px + Math.cos(a)*d;
      const y = py + Math.sin(a)*d;
      const spot = findOpenSpot(this.world, x, y);
      this.list.push(makeEnemy(spot.x, spot.y, level, false));
    }
  }

  spawnBoss(px, py, level=3){
    if(this.bossSpawned) return;
    this.bossSpawned = true;
    const a = Math.random()*Math.PI*2;
    const d = 140;
    const x = px + Math.cos(a)*d;
    const y = py + Math.sin(a)*d;
    const spot = findOpenSpot(this.world, x, y);
    this.list.push(makeEnemy(spot.x, spot.y, level+2, true));
  }

  update(dt, player, world){
    for(const e of this.list){
      if(e.hp<=0) continue;

      // cooldowns
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.atkCD = Math.max(0, e.atkCD - dt);
      e.stun = Math.max(0, e.stun - dt);

      // physics drift
      e.vx *= Math.pow(0.001, dt*6);
      e.vy *= Math.pow(0.001, dt*6);

      if(e.stun > 0) {
        // stunned, only drift
        e.x += e.vx*dt;
        e.y += e.vy*dt;
        continue;
      }

      // chase player (simple)
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx,dy) || 1;
      const dirx = dx/dist;
      const diry = dy/dist;

      // steering: if forward is blocked, sidestep a bit
      const trySp = e.speed;
      let mx = dirx;
      let my = diry;

      const nxF = e.x + mx*trySp*dt;
      const nyF = e.y + my*trySp*dt;

      if(world.isBlockedCircle(nxF, nyF, e.r)){
        // rotate left/right random
        const s = (Math.random()<0.5 ? -1 : 1);
        const rx = mx*Math.cos(0.9*s) - my*Math.sin(0.9*s);
        const ry = mx*Math.sin(0.9*s) + my*Math.cos(0.9*s);
        mx = rx; my = ry;
      }

      e.vx += mx * e.speed * (1 - Math.pow(0.001, dt*12));
      e.vy += my * e.speed * (1 - Math.pow(0.001, dt*12));

      // integrate with collision slide
      const nx = e.x + e.vx*dt;
      if(!world.isBlockedCircle(nx, e.y, e.r)) e.x = nx;
      else e.vx *= 0.25;

      const ny = e.y + e.vy*dt;
      if(!world.isBlockedCircle(e.x, ny, e.r)) e.y = ny;
      else e.vy *= 0.25;

      // attack if close
      if(e.atkCD<=0 && dist < (player.r + e.r + 2)){
        e.atkCD = e.boss ? 0.85 : 0.65;
        player.takeDamage(e.dmg);

        // knockback player
        player.kick(dirx*220*(e.boss?1.25:1.0), diry*220*(e.boss?1.25:1.0), 0.10);
      }
    }
  }

  // resolve player attack hitbox vs enemies
  resolvePlayerHit(hitbox){
    if(!hitbox) return { hits:0, kills:0 };

    let hits=0, kills=0;
    for(const e of this.list){
      if(e.hp<=0) continue;
      const d = Math.hypot(e.x-hitbox.x, e.y-hitbox.y);
      if(d < (e.r + hitbox.r)){
        e.hp -= hitbox.dmg;
        e.hitFlash = 0.12;
        e.stun = 0.07;

        // knockback enemy away from hitbox
        const dx = e.x - hitbox.x;
        const dy = e.y - hitbox.y;
        const len = Math.hypot(dx,dy) || 1;
        const k = hitbox.kb;
        e.vx += (dx/len)*k;
        e.vy += (dy/len)*k;

        hits++;
        if(e.hp<=0){
          kills++;
        }
      }
    }
    return { hits, kills };
  }

  draw(ctx, camX, camY){
    for(const e of this.list){
      if(e.hp<=0) continue;
      const x = (e.x - camX)|0;
      const y = (e.y - camY)|0;

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-6, y+7, 12, 3);

      // glow
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.10)" : "rgba(138,46,255,0.14)";
      ctx.fillRect(x-10, y-10, 20, 20);

      // body
      const flash = e.hitFlash>0 ? 0.55 : 0.0;
      ctx.fillStyle = e.boss
        ? `rgba(30,0,10,${0.90+flash})`
        : `rgba(18,0,26,${0.90+flash})`;
      ctx.fillRect(x-6, y-6, 12, 12);

      // core
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.85)" : "rgba(138,46,255,0.85)";
      ctx.fillRect(x-2, y-2, 4, 4);

      // tiny hp bar
      const w = 14;
      const hp = Math.max(0, e.hp)/e.hpMax;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x-7, y-12, w, 2);
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.95)" : "rgba(255,255,255,0.75)";
      ctx.fillRect(x-7, y-12, (w*hp)|0, 2);

      if(e.boss){
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(x-7, y-15, 14, 1);
      }
    }
  }
}

function makeEnemy(x,y,level,isBoss){
  const hpMax = isBoss ? (90 + level*18) : (26 + level*8);
  return {
    x,y,
    vx:0, vy:0,
    r: isBoss ? 9 : 7,
    speed: isBoss ? (34 + level*2) : (36 + level*3),
    dmg: isBoss ? (14 + (level*1.2)|0) : (7 + (level*0.8)|0),
    hpMax,
    hp: hpMax,
    hitFlash: 0,
    atkCD: 0,
    stun: 0,
    boss: !!isBoss
  };
}

function findOpenSpot(world, x, y){
  for(let t=0;t<260;t++){
    const px = x + (Math.random()*2-1)*48;
    const py = y + (Math.random()*2-1)*48;
    if(!world.isBlockedCircle(px,py,10)) return {x:px|0,y:py|0};
  }
  return {x:x|0,y:y|0};
}

