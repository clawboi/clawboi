// src/enemies.js
// Enemy variety + boss + telegraphs + real damage
// Works with the Part 6 main.js calls:
// - new EnemyManager(world)
// - reset()
// - spawnWaveAround(x,y,level)
// - update(dt, player, world)
// --- enemy hits player (Part 7) ---
const hurt = enemies.resolveEnemyHits(player);
if(hurt.took){
  cam.kick(8, 0.12);
  fx.pulseDamage(0.22);
  fx.hitFlash(0.10);
  fx.text(player.x, player.y-18, `-${hurt.dmg} HP`, "danger");
}

// - draw(ctx, camX, camY)
// - resolvePlayerHit(hitbox)
// - aliveCount()
// PLUS Part 7 adds:
// - resolveEnemyHits(player, fx)

import { clamp } from "./utils.js";

export class EnemyManager{
  constructor(world){
    this.world = world;
    this.list = [];
    this.spawnBudget = 0;
    this.bossAlive = false;
    this._t = 0;
  }

  reset(){
    this.list.length = 0;
    this.spawnBudget = 0;
    this.bossAlive = false;
    this._t = 0;
  }

  aliveCount(){
    let n=0;
    for(const e of this.list) if(e.hp > 0) n++;
    return n;
  }

  // --- spawning ---
  spawnWaveAround(px, py, level=1){
    // enemy count scales slowly
    const base = 2 + ((level * 0.65) | 0);
    const count = clamp(base, 2, 10);

    for(let i=0;i<count;i++){
      const typeRoll = Math.random();
      let kind = "shadow";
      if(level >= 2 && typeRoll > 0.62) kind = "charger";
      if(level >= 3 && typeRoll > 0.82) kind = "wisp";

      const p = findSpawn(this.world, px, py, 85, 165);
      this.list.push(makeEnemy(kind, p.x, p.y, level));
    }

    // boss logic: spawn once when level hits 5 OR if player already cleared node (handled in main patch)
    // We keep boss spawn separate; main.js will call spawnBoss() when appropriate.
  }

  spawnBoss(px, py, level=1){
    if(this.bossAlive) return;
    const p = findSpawn(this.world, px, py, 140, 220);
    this.list.push(makeBoss(p.x, p.y, Math.max(1, level)));
    this.bossAlive = true;
  }

  // --- update AI ---
  (dt, player, world){
    this._t += dt;
    this.world = world;

    // player i-frames (stored on player safely)
    if(player._hurtCD == null) player._hurtCD = 0;
    player._hurtCD = Math.max(0, player._hurtCD - dt);

    for(const e of this.list){
      if(e.hp <= 0) continue;

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.atkCD    = Math.max(0, e.atkCD - dt);
      e.windup   = Math.max(0, e.windup - dt);
      e.stun     = Math.max(0, e.stun - dt);

      // boss phase update
      if(e.kind === "boss"){
        const hp01 = e.hp / e.hpMax;
        e.phase = (hp01 < 0.55) ? 2 : 1;
      }

      // stunned enemies drift less
      if(e.stun > 0){
        e.vx *= 0.86;
        e.vy *= 0.86;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue;
      }

      // target vector
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx,dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // ===== behaviors =====
      if(e.kind === "shadow"){
        // simple pursue with slight wobble
        const wob = Math.sin(this._t*4 + e.seed) * 0.28;
        const tx = nx*Math.cos(wob) - ny*Math.sin(wob);
        const ty = nx*Math.sin(wob) + ny*Math.cos(wob);

        const sp = e.speed;
        e.vx = tx * sp;
        e.vy = ty * sp;
      }

      if(e.kind === "charger"){
        // Chargers: approach until in range, windup, then dash burst
        if(e.dashT > 0){
          e.dashT -= dt;
          // keep dash velocity
          // (vx,vy already set during dash start)
        }else{
          // if close enough and ready: windup
          if(dist < 78 && e.atkCD <= 0 && e.windup <= 0){
            e.windup = 0.35; // telegraph window
            e.atkCD = 1.20;  // cooldown
            e.vx = 0;
            e.vy = 0;
          }

          if(e.windup > 0){
            // hold position, face player
            e.vx = 0;
            e.vy = 0;
            e.faceX = nx;
            e.faceY = ny;

            // dash triggers when windup ends
            if(e.windup - dt <= 0){
              const dashSp = e.speed * 4.2;
              e.vx = e.faceX * dashSp;
              e.vy = e.faceY * dashSp;
              e.dashT = 0.18;
            }
          }else{
            // normal move
            const sp = e.speed * 0.95;
            e.vx = nx * sp;
            e.vy = ny * sp;
            e.faceX = nx;
            e.faceY = ny;
          }
        }
      }

      if(e.kind === "wisp"){
        // Wisps: orbit and poke
        const orbitR = 46;
        e.orbitA += dt*(0.9 + e.speed*0.005);
        const ox = player.x + Math.cos(e.orbitA)*orbitR;
        const oy = player.y + Math.sin(e.orbitA)*orbitR;

        const ddx = ox - e.x;
        const ddy = oy - e.y;
        const d = Math.hypot(ddx,ddy) || 1;

        const sp = e.speed * 1.05;
        e.vx = (ddx/d)*sp;
        e.vy = (ddy/d)*sp;

        // occasional “poke” burst inwards
        e.pokeCD = Math.max(0, e.pokeCD - dt);
        if(e.pokeCD <= 0 && dist < 120){
          e.pokeCD = 1.1 + Math.random()*0.6;
          e.windup = 0.22;
          e.faceX = nx; e.faceY = ny;
        }
        if(e.windup > 0){
          // telegraph then poke
          if(e.windup - dt <= 0){
            e.vx += e.faceX * 220;
            e.vy += e.faceY * 220;
          }
        }
      }

      if(e.kind === "boss"){
        // Boss: slow stalk + 2 attacks
        // Attack A: shock ring (windup -> blast)
        // Attack B: triple dash in phase 2

        e.bossT += dt;

        // decide attack
        const wantRing = (e.atkCD <= 0 && dist < 130 && e.ringCD <= 0);
        const wantDash = (e.atkCD <= 0 && dist < 220 && e.phase === 2 && e.dashCD <= 0);

        if(e.bossMode === "idle"){
          // move toward player slowly
          const sp = e.speed * (e.phase === 2 ? 1.10 : 1.0);
          e.vx = nx * sp;
          e.vy = ny * sp;

          if(wantRing){
            e.bossMode = "ring_wind";
            e.windup = 0.55;
            e.atkCD = 1.40;
            e.ringCD = 2.20;
            e.ringR = 8;
            e.vx = 0; e.vy = 0;
          }else if(wantDash){
            e.bossMode = "dash_wind";
            e.windup = 0.40;
            e.atkCD = 1.00;
            e.dashCD = 2.80;
            e.dashLeft = 3;
            e.vx = 0; e.vy = 0;
            e.faceX = nx; e.faceY = ny;
          }
        }else if(e.bossMode === "ring_wind"){
          e.vx = 0; e.vy = 0;
          e.ringR += 80*dt;
          if(e.windup <= 0){
            // blast moment
            e.bossMode = "ring_blast";
            e.ringBlastT = 0.22;
            e.ringR = 14;
          }
        }else if(e.bossMode === "ring_blast"){
          e.ringBlastT -= dt;
          e.ringR += 520*dt;
          if(e.ringBlastT <= 0){
            e.bossMode = "idle";
          }
        }else if(e.bossMode === "dash_wind"){
          e.vx = 0; e.vy = 0;
          if(e.windup <= 0){
            e.bossMode = "dash_burst";
            startBossDash(e, player);
          }
        }else if(e.bossMode === "dash_burst"){
          e.dashT -= dt;
          if(e.dashT <= 0){
            e.dashLeft--;
            if(e.dashLeft > 0){
              e.bossMode = "dash_gap";
              e.gapT = 0.14;
              e.vx *= 0.2; e.vy *= 0.2;
            }else{
              e.bossMode = "idle";
            }
          }
        }else if(e.bossMode === "dash_gap"){
          e.gapT -= dt;
          e.vx *= 0.88; e.vy *= 0.88;
          if(e.gapT <= 0){
            e.bossMode = "dash_burst";
            startBossDash(e, player);
          }
        }

        // decay boss CDs
        e.ringCD = Math.max(0, e.ringCD - dt);
        e.dashCD = Math.max(0, e.dashCD - dt);
      }

      // integrate with soft collision
      const nxp = e.x + e.vx*dt;
      const nyp = e.y + e.vy*dt;

      const rr = e.r || 6;
      if(!world.isBlockedCircle(nxp, e.y, rr)) e.x = nxp;
      else e.vx *= -0.25;
      if(!world.isBlockedCircle(e.x, nyp, rr)) e.y = nyp;
      else e.vy *= -0.25;
    }

    // cleanup dead (keep some corpses? we hard remove for performance)
    if(this.list.length > 120){
      this.list = this.list.filter(e=>e.hp > 0);
    }

    // if boss died, allow future spawn
    this.bossAlive = this.list.some(e=>e.kind==="boss" && e.hp > 0);
  }

  // player hitbox vs enemies
  resolvePlayerHit(hb){
    if(!hb) return { hits:0, kills:0 };

    let hits=0, kills=0;

    for(const e of this.list){
      if(e.hp <= 0) continue;

      const d = Math.hypot(e.x - hb.x, e.y - hb.y);
      if(d < (e.r + hb.r)){
        e.hp -= hb.dmg;
        e.hitFlash = 0.12;
        e.stun = Math.max(e.stun, 0.06);

        // knockback from hit
        const dx = e.x - hb.x;
        const dy = e.y - hb.y;
        const len = Math.hypot(dx,dy) || 1;
        const kb = 140;
        e.vx += (dx/len) * kb;
        e.vy += (dy/len) * kb;

        hits++;
        if(e.hp <= 0){
          kills++;
          // small death pop (visual handled in draw by skipping once hp<=0)
        }
      }
    }

    return { hits, kills };
  }

  // enemies damaging player + boss special
  // returns a summary so main can do FX/camera/UI safely.
  resolveEnemyHits(player){
    let took = false;
    let dmg = 0;
    let hits = 0;

    if(player._hurtCD == null) player._hurtCD = 0;
    if(player._hurtCD > 0) return { took:false, dmg:0, hits:0 };

    for(const e of this.list){
      if(e.hp <= 0) continue;

      // boss ring blast damage
      if(e.kind === "boss" && e.bossMode === "ring_blast"){
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        // ring hits near its radius (band)
        const band = Math.abs(dist - e.ringR);
        if(band < 10){
          const d0 = 16 + (e.phase===2 ? 6 : 0);
          applyDamage(player, d0);
          dmg += d0;
          hits++;
          took = true;
        }
        continue;
      }

      // standard contact / dash hit
      if(e.atkCD > 0 && e.kind === "shadow"){
        // shadow contact checks still allowed
      }

      const dist = Math.hypot(player.x - e.x, player.y - e.y);
      const contact = dist < (player.r + e.r + 2);

      // charger dash hit: only during dash
      if(e.kind === "charger"){
        if(e.dashT > 0 && contact){
          const d0 = e.dmg;
          applyDamage(player, d0);
          dmg += d0; hits++; took = true;
          // bounce charger slightly
          e.vx *= -0.35;
          e.vy *= -0.35;
        }
        continue;
      }

      // wisp poke hit: during windup end moment or close contact
      if(e.kind === "wisp"){
        if((e.windup > 0 && e.windup < 0.08 && dist < 16) || contact){
          const d0 = e.dmg;
          applyDamage(player, d0);
          dmg += d0; hits++; took = true;
          e.pokeCD = Math.max(e.pokeCD, 0.8);
        }
        continue;
      }

      // boss dash hit
      if(e.kind === "boss"){
        if(e.bossMode === "dash_burst" && contact){
          const d0 = 18 + (e.phase===2 ? 6 : 0);
          applyDamage(player, d0);
          dmg += d0; hits++; took = true;
        } else if(contact && e.bossMode==="idle"){
          // slight touch damage
          const d0 = 10;
          applyDamage(player, d0);
          dmg += d0; hits++; took = true;
        }
        continue;
      }

      // shadow contact hit (with its own cooldown)
      if(e.kind === "shadow"){
        e.touchCD = Math.max(0, (e.touchCD||0) - 0); // (dt handled elsewhere; we just treat as simple)
        if(contact && e.atkCD <= 0){
          e.atkCD = 0.55;
          const d0 = e.dmg;
          applyDamage(player, d0);
          dmg += d0; hits++; took = true;
        }
      }
    }

    if(took){
      // i-frames after being hit
      player._hurtCD = 0.35;
    }

    return { took, dmg, hits };
  }

  draw(ctx, camX, camY){
    for(const e of this.list){
      if(e.hp <= 0) continue;

      const x = (e.x - camX) | 0;
      const y = (e.y - camY) | 0;

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-6, y+7, 12, 3);

      // telegraphs
      if(e.kind === "charger" && e.windup > 0){
        const a = 0.18 + (e.windup/0.35)*0.25;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI*2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(138,46,255,${a})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (e.faceX||0)*22, y + (e.faceY||0)*22);
        ctx.stroke();
      }

      if(e.kind === "wisp" && e.windup > 0){
        const a = 0.12 + (e.windup/0.22)*0.22;
        ctx.strokeStyle = `rgba(138,46,255,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI*2);
        ctx.stroke();
      }

      if(e.kind === "boss"){
        // boss aura
        ctx.fillStyle = "rgba(138,46,255,0.10)";
        ctx.fillRect(x-18, y-18, 36, 36);

        // boss ring telegraph / blast
        if(e.bossMode === "ring_wind" || e.bossMode === "ring_blast"){
          const a = (e.bossMode === "ring_blast") ? 0.35 : 0.18;
          ctx.strokeStyle = `rgba(138,46,255,${a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, e.ringR|0, 0, Math.PI*2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(255,255,255,${a*0.65})`;
          ctx.beginPath();
          ctx.arc(x, y, (e.ringR+6)|0, 0, Math.PI*2);
          ctx.stroke();
        }

        if(e.bossMode === "dash_wind"){
          const a = 0.18 + (e.windup/0.40)*0.25;
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI*2);
          ctx.stroke();
        }
      }

      // body color by type
      const flash = e.hitFlash > 0 ? 0.55 : 0.0;

      if(e.kind === "shadow"){
        ctx.fillStyle = `rgba(20,0,30,${0.85 + flash})`;
        ctx.fillRect(x-5, y-6, 10, 10);
        ctx.fillStyle = `rgba(138,46,255,${0.78})`;
        ctx.fillRect(x-2, y-3, 4, 4);
      }

      if(e.kind === "charger"){
        ctx.fillStyle = `rgba(10,10,16,${0.92 + flash})`;
        ctx.fillRect(x-6, y-7, 12, 12);
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(x-6, y+2, 12, 2);
        ctx.fillStyle = "rgba(138,46,255,0.95)";
        ctx.fillRect(x-2, y-2, 4, 4);
      }

      if(e.kind === "wisp"){
        ctx.fillStyle = `rgba(138,46,255,${0.15 + flash})`;
        ctx.fillRect(x-10, y-10, 20, 20);
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.fillRect(x-3, y-3, 6, 6);
        ctx.fillStyle = "rgba(138,46,255,0.85)";
        ctx.fillRect(x-1, y-1, 2, 2);
      }

      if(e.kind === "boss"){
        // boss body
        ctx.fillStyle = `rgba(10,10,16,${0.95 + flash})`;
        ctx.fillRect(x-12, y-14, 24, 24);
        ctx.fillStyle = "rgba(138,46,255,0.95)";
        ctx.fillRect(x-4, y-4, 8, 8);
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(x-12, y+6, 24, 2);

        // boss HP bar (above)
        const bw = 30;
        const hp = Math.max(0, e.hp)/e.hpMax;
        ctx.fillStyle = "rgba(0,0,0,0.60)";
        ctx.fillRect(x - (bw/2|0), y-20, bw, 3);
        ctx.fillStyle = "rgba(255,74,122,0.92)";
        ctx.fillRect(x - (bw/2|0), y-20, (bw*hp)|0, 3);
      }

      // tiny hp bar for non-boss
      if(e.kind !== "boss"){
        const w = 10;
        const hp = Math.max(0, e.hp)/e.hpMax;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x-5, y-10, w, 2);
        ctx.fillStyle = "rgba(255,74,122,0.9)";
        ctx.fillRect(x-5, y-10, (w*hp)|0, 2);
      }
    }
  }
}

/* ----------------- helpers ----------------- */

function makeEnemy(kind, x, y, level){
  if(kind === "charger"){
    const hpMax = 26 + level*7;
    return {
      kind,
      x,y,
      vx:0, vy:0,
      r: 7,
      speed: 42 + level*2.5,
      dmg: 10 + ((level*0.7)|0),
      hpMax, hp: hpMax,
      hitFlash: 0,
      atkCD: 0,
      windup: 0,
      dashT: 0,
      faceX: 1, faceY: 0,
      seed: Math.random()*999,
      stun: 0,
    };
  }

  if(kind === "wisp"){
    const hpMax = 20 + level*6;
    return {
      kind,
      x,y,
      vx:0, vy:0,
      r: 6,
      speed: 46 + level*2,
      dmg: 8 + ((level*0.6)|0),
      hpMax, hp: hpMax,
      hitFlash: 0,
      atkCD: 0,
      windup: 0,
      pokeCD: 0.6 + Math.random()*0.9,
      orbitA: Math.random()*Math.PI*2,
      faceX: 1, faceY: 0,
      seed: Math.random()*999,
      stun: 0,
    };
  }

  // default shadow
  const hpMax = 22 + level*6;
  return {
    kind:"shadow",
    x,y,
    vx:0, vy:0,
    r: 6,
    speed: 34 + level*3,
    dmg: 6 + ((level*0.6)|0),
    hpMax, hp: hpMax,
    hitFlash: 0,
    atkCD: 0,
    windup: 0,
    touchCD: 0,
    seed: Math.random()*999,
    stun: 0,
  };
}

function makeBoss(x,y,level){
  const hpMax = 180 + level*34;
  return {
    kind:"boss",
    x,y,
    vx:0, vy:0,
    r: 12,
    speed: 24 + level*1.2,
    dmg: 14 + ((level*0.7)|0),
    hpMax, hp: hpMax,
    hitFlash: 0,
    atkCD: 0,
    windup: 0,
    stun: 0,

    phase: 1,

    bossT: 0,
    bossMode: "idle",

    ringCD: 1.2,
    ringR: 0,
    ringBlastT: 0,

    dashCD: 1.0,
    dashT: 0,
    dashLeft: 0,
    gapT: 0,
    faceX: 1,
    faceY: 0,
  };
}

function startBossDash(e, player){
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx,dy) || 1;
  const nx = dx/dist;
  const ny = dy/dist;

  e.faceX = nx; e.faceY = ny;
  const sp = (e.phase===2 ? 520 : 430);
  e.vx = nx * sp;
  e.vy = ny * sp;
  e.dashT = 0.18;
}

function applyDamage(player, n){
  if(typeof player.takeDamage === "function"){
    player.takeDamage(n);
  }else{
    // fallback
    player.hp = Math.max(0, (player.hp ?? 0) - n);
  }
}

function findSpawn(world, px, py, dMin, dMax){
  for(let tries=0; tries<900; tries++){
    const a = Math.random()*Math.PI*2;
    const d = dMin + Math.random()*(dMax - dMin);
    const x = px + Math.cos(a)*d;
    const y = py + Math.sin(a)*d;

    if(!world.isBlockedCircle(x,y,8)){
      return { x:x|0, y:y|0 };
    }
  }
  return { x:(px + dMin)|0, y:py|0 };
}
