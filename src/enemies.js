import { clamp } from "./utils.js";

/* EnemyManager (drop-in):
  - simple AI chase
  - collision with world tiles
  - hit + knockback
  - spawns waves + mini-boss
  - SAFE: no NaN hp, no immortal enemies, has resolvePlayerAttack(player)
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
    let n = 0;
    for(const e of this.list) if(e && e.hp > 0) n++;
    return n;
  }

  spawnWaveAround(px, py, level=1){
    const count = Math.min(10, 2 + ((level * 0.7) | 0));
    for(let i=0;i<count;i++){
      const a = Math.random() * Math.PI * 2;
      const d = 80 + Math.random() * 120;
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      const spot = findOpenSpot(this.world, x, y);
      this.list.push(makeEnemy(spot.x, spot.y, level, false));
    }
  }

  spawnBoss(px, py, level=3){
    if(this.bossSpawned) return;
    this.bossSpawned = true;

    const a = Math.random() * Math.PI * 2;
    const d = 140;
    const x = px + Math.cos(a) * d;
    const y = py + Math.sin(a) * d;
    const spot = findOpenSpot(this.world, x, y);
    this.list.push(makeEnemy(spot.x, spot.y, level + 2, true));
  }

  update(dt, player, world){
    // keep reference fresh if you swap worlds
    this.world = world;

    for(const e of this.list){
      if(!e || e.hp <= 0) continue;

      // timers
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.atkCD    = Math.max(0, e.atkCD - dt);
      e.stun     = Math.max(0, e.stun - dt);
      e.iframes  = Math.max(0, e.iframes - dt);

      // friction (stable)
      const fr = Math.pow(0.001, dt*6);
      e.vx *= fr;
      e.vy *= fr;

      // stunned = drift only
      if(e.stun > 0){
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue;
      }

      // chase
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx,dy) || 1;
      const dirx = dx / dist;
      const diry = dy / dist;

      let mx = dirx;
      let my = diry;

      // steer if forward is blocked
      const nxF = e.x + mx * e.speed * dt;
      const nyF = e.y + my * e.speed * dt;
      if(world.isBlockedCircle(nxF, nyF, e.r)){
        const s = (Math.random() < 0.5 ? -1 : 1);
        const c = Math.cos(0.9*s);
        const sn = Math.sin(0.9*s);
        const rx = mx*c - my*sn;
        const ry = mx*sn + my*c;
        mx = rx; my = ry;
      }

      // accelerate toward move direction
      const accel = (1 - Math.pow(0.001, dt*12));
      e.vx += mx * e.speed * accel;
      e.vy += my * e.speed * accel;

      // integrate with collision slide
      const nx = e.x + e.vx * dt;
      if(!world.isBlockedCircle(nx, e.y, e.r)) e.x = nx;
      else e.vx *= 0.25;

      const ny = e.y + e.vy * dt;
      if(!world.isBlockedCircle(e.x, ny, e.r)) e.y = ny;
      else e.vy *= 0.25;

      // attack
      if(e.atkCD <= 0 && dist < (player.r + e.r + 2)){
        e.atkCD = e.boss ? 0.95 : 0.75;

        // ✅ slightly nerfed early feel
        player.takeDamage(e.dmg);

        // knockback player away from enemy -> player
        const pxDir = (dist > 0) ? (dx / dist) : 0;
        const pyDir = (dist > 0) ? (dy / dist) : 0;
        const k = 210 * (e.boss ? 1.15 : 1.0);
        player.kick(pxDir * k, pyDir * k, 0.10);
      }
    }
  }

  /* ✅ the method your main.js calls */
    resolvePlayerAttack(player, hbOverride){
  const hb = hbOverride || player?.getAttackHitbox?.();
  if(!hb) return { count:0, kills:0 };

    // harden hitbox values so they never create NaN enemies
    const hx = Number.isFinite(hb.x) ? hb.x : player.x;
    const hy = Number.isFinite(hb.y) ? hb.y : player.y;
    const hr = Number.isFinite(hb.r) ? hb.r : 14;
    const dmg = Number.isFinite(hb.dmg) ? hb.dmg : 12;
    const kb = Number.isFinite(hb.kb) ? hb.kb : 240;

    let count = 0;
    let kills = 0;

    for(const e of this.list){
      if(!e || e.hp <= 0) continue;

      // enemy i-frames (prevents multi-hit per frame)
      if(e.iframes > 0) continue;

      const dx = e.x - hx;
      const dy = e.y - hy;
      const dist = Math.hypot(dx,dy);

      if(dist < (hr + (e.r || 7))){
        // damage
        e.hp -= dmg;
        if(!Number.isFinite(e.hp)) e.hp = 0; // ✅ NaN safety
        e.hitFlash = 0.12;
        e.stun = 0.06;
        e.iframes = 0.08; // tiny grace so one swing = one hit

        // knockback enemy away from hitbox
        const len = dist || 1;
        e.vx += (dx/len) * kb;
        e.vy += (dy/len) * kb;

        count++;
        if(e.hp <= 0) kills++;
      }
    }

    return { count, kills };
  }

  draw(ctx, camX, camY){
    for(const e of this.list){
      if(!e || e.hp <= 0) continue;

      const x = (e.x - camX) | 0;
      const y = (e.y - camY) | 0;

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-6, y+7, 12, 3);

      // glow
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.10)" : "rgba(138,46,255,0.14)";
      ctx.fillRect(x-10, y-10, 20, 20);

      // body
      const flash = e.hitFlash > 0 ? 0.55 : 0.0;
      ctx.fillStyle = e.boss
        ? `rgba(30,0,10,${0.90+flash})`
        : `rgba(18,0,26,${0.90+flash})`;
      ctx.fillRect(x-6, y-6, 12, 12);

      // core
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.85)" : "rgba(138,46,255,0.85)";
      ctx.fillRect(x-2, y-2, 4, 4);

      // tiny hp bar (optional but helps feel)
      const w = 14;
      const hp = Math.max(0, e.hp) / (e.hpMax || 1);
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      ctx.fillRect(x-7, y-12, w, 2);
      ctx.fillStyle = e.boss ? "rgba(255,74,122,0.95)" : "rgba(255,255,255,0.75)";
      ctx.fillRect(x-7, y-12, (w*hp)|0, 2);
    }
  }
}

/* ---------- helpers ---------- */

function makeEnemy(x,y,level,isBoss){
  const hpMax = isBoss ? (90 + level*18) : (26 + level*8);

  // ✅ slightly nerfed early damage so you don’t insta-die
  const dmg = isBoss
    ? (10 + (level*1.0)|0)
    : (4  + (level*0.6)|0);

  return {
    x, y,
    vx: 0, vy: 0,
    r: isBoss ? 9 : 7,
    speed: isBoss ? (34 + level*2) : (36 + level*3),
    dmg,
    hpMax,
    hp: hpMax,
    hitFlash: 0,
    atkCD: 0,
    stun: 0,
    iframes: 0,
    boss: !!isBoss
  };
}

function findOpenSpot(world, x, y){
  for(let t=0; t<260; t++){
    const px = x + (Math.random()*2 - 1) * 48;
    const py = y + (Math.random()*2 - 1) * 48;
    if(!world.isBlockedCircle(px, py, 10)) return { x: px|0, y: py|0 };
  }
  return { x: x|0, y: y|0 };
}
