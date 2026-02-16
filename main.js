/* =========================================================
   MAIN — Game Loop + States + Camera + Spawning + Mobile
   - Start screen
   - Play state
   - Boss state (simple intro + lock arena)
   - Death screen + restart
   - Optimized canvas scaling (pixel sharp)
   ========================================================= */

import { Player } from "./player.js";
import { World } from "./world.js";
import { EnemyManager } from "./enemies.js";
import { Effects } from "./effects.js";
import { UI } from "./ui.js";

/* ------------------ Canvas setup ------------------ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const STATE = {
  START: "start",
  PLAY: "play",
  BOSS: "boss",
  DEAD: "dead",
};

const config = {
  baseW: 320,
  baseH: 180,
  scale: 4,               // auto-adjusted by resize
  maxScale: 6,
  minScale: 3,
  dtCap: 1/30,            // prevents big physics jumps
};

let viewW = config.baseW * config.scale;
let viewH = config.baseH * config.scale;

function resize(){
  // keep pixel sharpness: integer scaling
  const ww = window.innerWidth;
  const wh = window.innerHeight;

  const sx = Math.floor(ww / config.baseW);
  const sy = Math.floor(wh / config.baseH);
  config.scale = Math.max(config.minScale, Math.min(config.maxScale, Math.min(sx, sy)));

  viewW = config.baseW * config.scale;
  viewH = config.baseH * config.scale;

  canvas.width = viewW;
  canvas.height = viewH;

  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";

  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);
resize();

/* ------------------ Input ------------------ */
const keys = new Set();

window.addEventListener("keydown", (e)=>{
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  // Start/restart convenience
  if(state === STATE.START && (e.key === "Enter" || e.key === " ")){
    startGame();
  }
  if(state === STATE.DEAD && (e.key === "Enter" || e.key === " ")){
    startGame();
  }
});

window.addEventListener("keyup", (e)=>{
  keys.delete(e.key.toLowerCase());
});

function isDown(k){ return keys.has(k); }

/* Mobile virtual stick + buttons (optional)
   If you don’t have these in HTML yet, this code safely no-ops.
*/
const mobile = {
  stick: document.getElementById("stick"),
  knob: document.getElementById("knob"),
  btnA: document.getElementById("btnA"), // attack
  btnB: document.getElementById("btnB"), // dash
  active: false,
  ax: 0, ay: 0,
};

function setupMobile(){
  if(!mobile.stick || !mobile.knob) return;

  let sx=0, sy=0, dragging=false;

  const setAxes = (dx,dy)=>{
    const r = 32; // knob radius
    const len = Math.hypot(dx,dy);
    const nx = len ? dx/len : 0;
    const ny = len ? dy/len : 0;
    const mag = Math.min(1, len/r);

    mobile.ax = nx * mag;
    mobile.ay = ny * mag;
    mobile.knob.style.transform = `translate(${Math.floor(nx*mag*r)}px, ${Math.floor(ny*mag*r)}px)`;
  };

  mobile.stick.addEventListener("pointerdown",(e)=>{
    dragging=true;
    mobile.active=true;
    const rect = mobile.stick.getBoundingClientRect();
    sx = rect.left + rect.width/2;
    sy = rect.top + rect.height/2;
    setAxes(e.clientX - sx, e.clientY - sy);
    e.preventDefault();
  }, {passive:false});

  window.addEventListener("pointermove",(e)=>{
    if(!dragging) return;
    setAxes(e.clientX - sx, e.clientY - sy);
  }, {passive:true});

  window.addEventListener("pointerup",()=>{
    dragging=false;
    mobile.active=false;
    mobile.ax=0; mobile.ay=0;
    if(mobile.knob) mobile.knob.style.transform = `translate(0px,0px)`;
  }, {passive:true});

  if(mobile.btnA){
    mobile.btnA.addEventListener("pointerdown",(e)=>{
      keys.add("j"); e.preventDefault();
    }, {passive:false});
    mobile.btnA.addEventListener("pointerup",()=> keys.delete("j"), {passive:true});
    mobile.btnA.addEventListener("pointercancel",()=> keys.delete("j"), {passive:true});
  }
  if(mobile.btnB){
    mobile.btnB.addEventListener("pointerdown",(e)=>{
      keys.add("k"); e.preventDefault();
    }, {passive:false});
    mobile.btnB.addEventListener("pointerup",()=> keys.delete("k"), {passive:true});
    mobile.btnB.addEventListener("pointercancel",()=> keys.delete("k"), {passive:true});
  }
}
setupMobile();

/* ------------------ Game objects ------------------ */
let state = STATE.START;

let world = null;
let player = null;
let enemies = null;
let effects = null;
let ui = null;

const camera = {
  x: 0, y: 0,
  shake: 0,
  shakeT: 0,
};

function camShake(power=3, time=0.15){
  camera.shake = Math.max(camera.shake, power);
  camera.shakeT = Math.max(camera.shakeT, time);
}

/* ------------------ Progression + Spawning ------------------ */
let spawnT = 0;
let bossGate = {
  nextAtLevel: 3,
  active: false,
  bossName: "THE WATCHER",
  bossId: "watcher",
};

function startGame(){
  world = new World({
    seed: Math.floor(Math.random()*1e9),
    w: 256, h: 256,
  });

  player = new Player({
    x: world.spawnX,
    y: world.spawnY,
  });

  enemies = new EnemyManager(world);
  effects = new Effects();
  ui = new UI();

  spawnT = 0;
  bossGate.active = false;
  bossGate.nextAtLevel = 3;

  ui.toast("ENTER THE FOREST NODE", 1.2);
  state = STATE.PLAY;
}

function spawnWave(){
  // scales with level + hallucination
  const base = 2 + Math.floor(player.level * 0.6);
  const extra = effects.hallucination > 0.2 ? 2 : 0;

  const count = Math.min(10, base + extra);
  for(let i=0;i<count;i++){
    const p = world.randomPointNear(player.x, player.y, 220, 420);
    enemies.spawnRandom(p.x, p.y, player.level);
  }
}

/* Boss trigger rules:
   - When player hits a level milestone, show intro + lock arena
*/
function maybeTriggerBoss(){
  if(bossGate.active) return;
  if(player.level < bossGate.nextAtLevel) return;

  bossGate.active = true;
  state = STATE.BOSS;

  // cinematic
  ui.bannerText(bossGate.bossName, "IT SEES THROUGH YOU", 2.6);
  ui.toast("BOSS APPROACHING", 1.2);
  camShake(6, 0.25);

  // clear trash mobs, spawn boss
  enemies.clearAllNonBoss?.();
  enemies.spawnBoss?.(bossGate.bossId, player, world);

  // arena lock (optional: world can support soft walls)
  world.lockArena?.(player.x, player.y, 420);
}

/* ------------------ Update ------------------ */
function getMoveInput(){
  // keyboard (WASD or arrows)
  let mx = 0, my = 0;

  if(isDown("a") || isDown("arrowleft")) mx -= 1;
  if(isDown("d") || isDown("arrowright")) mx += 1;
  if(isDown("w") || isDown("arrowup")) my -= 1;
  if(isDown("s") || isDown("arrowdown")) my += 1;

  // mobile stick overrides/adds
  if(mobile.active){
    mx += mobile.ax;
    my += mobile.ay;
  }

  // normalize
  const len = Math.hypot(mx,my);
  if(len>1e-6){
    mx /= Math.max(1, len);
    my /= Math.max(1, len);
  }
  return {mx,my};
}

function update(dt){
  if(state === STATE.START){
    // subtle background animation could go here
    return;
  }

  if(state === STATE.DEAD){
    // allow UI fade etc.
    ui?.update(dt);
    effects?.update(dt);
    return;
  }

  // global
  ui.update(dt);
  effects.update(dt);

  const {mx,my} = getMoveInput();

  // player controls
  player.setMove(mx,my);

  const attacking = isDown("j") || isDown(" ");
  const dashing = isDown("k") || isDown("shift");

  if(attacking) player.tryAttack();
  if(dashing) player.tryDash();

  // update player + world interactions
  player.update(dt, world, effects);

  // item pickups
  const pickup = world.tryPickup(player.x, player.y);
  if(pickup){
    // inventory / xp / hallucination trigger
    player.addItem(pickup);
    player.addXP(pickup.xp ?? 2);

    ui.floater((player.x - camera.x) * config.scale, (player.y - camera.y) * config.scale, `+${pickup.xp ?? 2} XP`);

    if(pickup.kind === "mushroom" || pickup.kind === "potion"){
      effects.triggerHallucination(1.0);
      ui.toast("HALLUCINATION MODE", 1.1);
      camShake(4,0.12);
    }
    if(pickup.kind === "crystal"){
      ui.toast("VIOLET CRYSTAL", 0.9);
    }
  }

  // enemies
  enemies.update(dt, player, world, effects);

  // combat resolution: player sword vs enemies
  const hit = enemies.resolvePlayerAttack(player);
  if(hit?.count){
    camShake(2 + hit.count, 0.08);
    effects.hitFlash(0.12);
    // XP per kill handled inside enemies or here:
    if(hit.kills){
      player.addXP(hit.kills * 6);
      ui.floater((player.x - camera.x) * config.scale, (player.y - camera.y) * config.scale, `+${hit.kills*6} XP`);
    }
  }

  // enemy attacks vs player
  const took = enemies.resolveEnemyHits(player);
  if(took){
    effects.damagePulse(0.22);
    camShake(5, 0.12);
    ui.toast("HIT", 0.35);
  }

  // level up check (player module usually handles this, but we support either)
  if(player.didLevelUp){
    const n = player.didLevelUp();
    if(n){
      ui.toast(`LEVEL UP → ${player.level}`, 1.0);
      camShake(6, 0.18);
    }
  }

  // spawning loop
  spawnT -= dt;
  if(spawnT <= 0 && state === STATE.PLAY){
    spawnWave();
    spawnT = Math.max(1.6, 3.2 - player.level*0.12);
  }

  // boss triggers
  maybeTriggerBoss();

  // boss state exit if boss dead
  if(state === STATE.BOSS){
    const bossAlive = enemies.hasBossAlive?.() ?? false;
    if(!bossAlive){
      ui.toast("BOSS DEFEATED", 1.4);
      camShake(8, 0.25);
      effects.hallucination = Math.max(effects.hallucination, 0.35);

      // unlock arena and schedule next boss
      world.unlockArena?.();
      bossGate.active = false;
      bossGate.nextAtLevel += 3;
      state = STATE.PLAY;
    }
  }

  // camera follow
  camera.x += (player.x - config.baseW/2 - camera.x) * (1 - Math.pow(0.001, dt));
  camera.y += (player.y - config.baseH/2 - camera.y) * (1 - Math.pow(0.001, dt));

  // clamp to world bounds if available
  if(world.bounds){
    camera.x = clamp(camera.x, 0, world.bounds.w - config.baseW);
    camera.y = clamp(camera.y, 0, world.bounds.h - config.baseH);
  }

  // camera shake
  if(camera.shakeT > 0){
    camera.shakeT -= dt;
    camera.shake *= 0.86;
    if(camera.shakeT <= 0) camera.shake = 0;
  }

  // death
  if(player.hp <= 0 && state !== STATE.DEAD){
    state = STATE.DEAD;
    ui.bannerText("YOU DIED", "PRESS ENTER / TAP TO RESTART", 999);
    ui.toast("THE FOREST ATE YOU", 1.6);
    camShake(10, 0.28);
  }
}

/* ------------------ Render ------------------ */
function draw(){
  // clear
  ctx.fillStyle = "#050508";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // pixel world render uses base resolution coords
  // We render everything in base resolution then scale up
  ctx.scale(config.scale, config.scale);

  // shake offset in base pixels
  let sx=0, sy=0;
  if(camera.shake>0){
    sx = (Math.random()*2-1) * camera.shake * 0.7;
    sy = (Math.random()*2-1) * camera.shake * 0.7;
  }

  const camX = Math.floor(camera.x + sx);
  const camY = Math.floor(camera.y + sy);

  // world
  world?.draw(ctx, camX, camY, effects);

  // enemies
  enemies?.draw(ctx, camX, camY, effects);

  // player
  player?.draw(ctx, camX, camY, effects);

  // screen-space effects overlay (drawn in base res)
  effects?.drawOverlay(ctx, config.baseW, config.baseH);

  ctx.restore();

  // UI in scaled pixels (full-res canvas coords)
  if(ui && player && effects){
    ui.draw(ctx, player, effects);
  }

  // Start / Dead overlays
  if(state === STATE.START){
    drawStart();
  }else if(state === STATE.DEAD){
    drawDead();
  }

  requestAnimationFrame(draw);
}

function drawStart(){
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", canvas.width/2, canvas.height/2 - 20);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("PRESS ENTER / TAP TO BEGIN", canvas.width/2, canvas.height/2 + 16);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("MOVE: WASD / ARROWS  •  ATTACK: J  •  DASH: K", canvas.width/2, canvas.height/2 + 44);

  ctx.restore();

  // allow tap to start
  canvas.onclick = ()=> startGame();
}

function drawDead(){
  ctx.save();
  // UI already draws banner, but we darken a bit
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  canvas.onclick = ()=> startGame();
  ctx.restore();
}

/* ------------------ Loop ------------------ */
let last = performance.now();
function loop(now){
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(config.dtCap, rawDt);

  update(dt);
  // draw is on rAF; we also draw here for deterministic timing
  // (But keep single draw call: we call draw separately)
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
requestAnimationFrame(draw);

/* ------------------ Boot ------------------ */
state = STATE.START;
