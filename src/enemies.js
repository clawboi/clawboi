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

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.atkCD = Math.max(0, e.atkCD - dt);
      e.stun = Math.max(0, e.stun - dt);

      e.vx *= Math.pow(0.001, dt*6);
      e.vy *= Math.pow(0.001, dt*6);

      if(e.stun > 0){
        e.x += e.vx*dt;
        e.y += e.vy*dt;
        continue;
      }

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx,dy) || 1;
      const dirx = dx/dist;
      const diry = dy/dist;

      let mx = dirx;
      let my = diry;

      const nxF = e.x + mx*e.speed*dt;
      const nyF = e.y + my*e.speed*dt;

      if(world.isBlockedCircle(nxF, nyF, e.r)){
        const s = (Math.random()<0.5 ? -1 : 1);
        const rx = mx*Math.cos(0.9*s) - my*Math.sin(0.9*s);
        const ry = mx*Math.sin(0.9*s) + my*Math.cos(0.9*s);
        mx = rx;
        my = ry;
      }

      e.vx += mx * e.speed * (1 - Math.pow(0.001, dt*12));
      e.vy += my * e.speed * (1 - Math.pow(0.001, dt*12));

      const nx = e.x + e.vx*dt;
      if(!world.isBlockedCircle(nx, e.y, e.r)) e.x = nx;
      else e.vx *= 0.25;

      const ny = e.y + e.vy*dt;
      if(!world.isBlockedCircle(e.x, ny, e.r)) e.y = ny;
      else e.vy *= 0.25;

      if(e.atkCD<=0 && dist < (player.r + e.r + 2)){
        e.atkCD = e.boss ? 0.85 : 0.65;
        player.takeDamage(e.dmg);
        player.kick(dirx*220*(e.boss?1.25:1.0), diry*220*(e.boss?1.25:1.0), 0.10);
      }
    }
  }

  /* ✅ THIS IS THE METHOD YOUR GAME WAS CRASHING FOR */
  resolvePlayerAttack(player){
    const hb = player.getAttackHitbox?.();
    if(!hb) return {count:0,kills:0};

    let count = 0;
    let kills = 0;

    for(const e of this.list){
      if(!e || e.hp <= 0) continue;

      const dx = e.x - hb.x;
      const dy = e.y - hb.y;
      const dist = Math.hypot(dx,dy);

      if(dist < (hb.r + (e.r||6))){
        e.hp -= hb.dmg || 10;
        e.hitFlash = 0.12;
        count++;

        if(e.hp <= 0){
          kills++;
        }
      }
    }

    return {count, kills};
  }

  draw(ctx, camX, camY){
    for(const e of this.list){
      if(e.hp<=0) continue;
      const x = (e.x - camX)|0;
      const y = (e.y - camY)|0;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-6, y+7, 12, 3);

      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.10)" : "rgba(138,46,255,0.14)";
      ctx.fillRect(x-10, y-10, 20, 20);

      const flash = e.hitFlash>0 ? 0.55 : 0.0;
      ctx.fillStyle = e.boss
        ? `rgba(30,0,10,${0.90+flash})`
        : `rgba(18,0,26,${0.90+flash})`;
      ctx.fillRect(x-6, y-6, 12, 12);

      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.85)" : "rgba(138,46,255,0.85)";
      ctx.fillRect(x-2, y-2, 4, 4);
    }
  }
}

/* ---------- helpers ---------- */

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
