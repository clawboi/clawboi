import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { Camera } from "./camera.js";
import { PickupManager } from "./pickups.js";
import { EnemyManager } from "./enemies.js";
import { DropManager } from "./drops.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha:false });

const debugEl = document.getElementById("debug");
let debugOn = false;

const mobileAtkBtn = document.getElementById("mAtk");
const mobileDashBtn = document.getElementById("mDash");

/* ---------- canvas scaling ---------- */
const view = { scale: CONFIG.minScale, pxW:0, pxH:0 };

function calcScale(){
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const sx = Math.floor(ww / CONFIG.baseW);
  const sy = Math.floor(wh / CONFIG.baseH);
  return clamp(Math.min(sx, sy), CONFIG.minScale, CONFIG.maxScale);
}
function resize(){
  view.scale = calcScale();
  view.pxW = CONFIG.baseW * view.scale;
  view.pxH = CONFIG.baseH * view.scale;

  canvas.width = view.pxW;
  canvas.height = view.pxH;
  canvas.style.width = view.pxW + "px";
  canvas.style.height = view.pxH + "px";
  ctx.imageSmoothingEnabled = false;

  if(cam) cam.resizeView(CONFIG.baseW, CONFIG.baseH);
}
window.addEventListener("resize", resize, {passive:true});
resize();

/* ---------- debug toggle ---------- */
window.addEventListener("keydown", (e)=>{
  if(e.key === "`"){
    debugOn = !debugOn;
    debugEl.style.display = debugOn ? "block" : "none";
  }
}, {passive:true});

/* ---------- input ---------- */
const input = new Input({ canvas, mobileAtkBtn, mobileDashBtn });

/* ---------- state ---------- */
const STATE = { START:"start", PLAY:"play", WIN:"win", DEAD:"dead" };
let state = STATE.START;

let world = null;
let player = null;
let cam = null;
let pickups = null;
let enemies = null;
let drops = null;

let tWorld = 0;

// objective
const objective = {
  shardsNeeded: 3,
  portalOpen: false,
  win: false
};

function startGame(){
  world = new WorldForest({
    tilesW: 160,
    tilesH: 120,
    tileSize: 8,
    seed: (Math.random()*1e9)|0
  });

  player = new PlayerTest(world.spawn.x, world.spawn.y);

  cam = new Camera({
    viewW: CONFIG.baseW,
    viewH: CONFIG.baseH,
    worldW: world.worldW,
    worldH: world.worldH
  });

  pickups = new PickupManager();
  pickups.reset(objective.shardsNeeded);

  enemies = new EnemyManager(world);
  enemies.reset();

  drops = new DropManager();
  drops.reset();

  // spawn shards near open tiles around spawn
  for(let i=0;i<objective.shardsNeeded;i++){
    const p = findOpenSpot(world, world.spawn.x, world.spawn.y, 220 + i*90);
    pickups.addShard(p.x, p.y);
  }

  objective.portalOpen = false;
  objective.win = false;
  world.setPortalActive(false);

  // start enemies
  enemies.spawnWaveAround(player.x, player.y, player.level);

  state = STATE.PLAY;
}

function findOpenSpot(world, cx, cy, radius){
  for(let tries=0; tries<1200; tries++){
    const a = Math.random()*Math.PI*2;
    const d = radius * (0.35 + Math.random()*0.65);
    const x = cx + Math.cos(a)*d;
    const y = cy + Math.sin(a)*d;
    if(!world.isBlockedCircle(x,y,10)) return {x:x|0,y:y|0};
  }
  return {x:cx|0,y:cy|0};
}

canvas.addEventListener("pointerdown", ()=>{
  if(state === STATE.START) startGame();
  if(state === STATE.WIN) startGame();
  if(state === STATE.DEAD) startGame();
}, { passive:true });

window.addEventListener("keydown", (e)=>{
  const k = (e.key||"").toLowerCase();
  if((state === STATE.START || state === STATE.WIN || state === STATE.DEAD) && (k==="enter" || k===" ")) startGame();
}, { passive:true });

/* ---------- loop ---------- */
let last = now();
let fpsS = 0;

function loop(t){
  const rawDt = (t - last)/1000;
  last = t;
  const dt = Math.min(CONFIG.dtCap, rawDt);

  const fps = dt>0 ? 1/dt : 0;
  fpsS = lerp(fpsS || fps, fps, 0.08);

  update(dt);
  draw(fpsS);

  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

let waveTimer = 0;

function update(dt){
  if(state === STATE.START || state === STATE.WIN || state === STATE.DEAD) return;

  tWorld += dt;

  // actions
  if(input.dash()){
    const ok = player.tryDash();
    if(ok) cam.kick(3.5, 0.10);
  }

  if(input.attack()){
    const ok = player.tryAttack();
    if(ok) cam.kick(1.8, 0.06);
  }

  // movement + collision
  player.update(dt, input, world);

  // enemies
  enemies.update(dt, player, world);

  // resolve player hitbox vs enemies
  const hb = player.getHitbox();
  const res = enemies.resolvePlayerHit(hb);
  if(res.hits){
    cam.kick(2.2 + res.hits*0.4, 0.08);

    // kills drop essence
    if(res.kills){
      // spawn essence at each killed enemy position (approx)
      // quick: loop and spawn around player hitbox
      drops.spawnEssence(hb.x, hb.y, 6 + res.kills*3);
      player.addXP(res.kills * 10);
    }
  }

  // drops
  drops.update(dt, world);
  const got = drops.tryCollect(player);
  if(got){
    // each essence gives a little hp + xp
    player.heal(got * 2);
    player.addXP(got * 1);
  }

  // pickups (shards)
  pickups.update(dt);
  const gotShard = pickups.tryCollect(player);
  if(gotShard){
    cam.kick(5.5, 0.12);

    // after 2 shards, spawn boss once
    if(pickups.collected === 2){
      enemies.spawnBoss(player.x, player.y, player.level);
      cam.kick(10, 0.18);
    }
  }

  // portal opens only after shards AND boss dead (if spawned)
  const bossAlive = enemies.list.some(e=>e.boss && e.hp>0);
  const canOpen = pickups.done() && !bossAlive;

  if(!objective.portalOpen && canOpen){
    objective.portalOpen = true;
    world.setPortalActive(true);
    cam.kick(8, 0.18);
  }

  // wave spawns (keeps pressure)
  waveTimer -= dt;
  if(waveTimer <= 0){
    // don’t overwhelm if too many alive
    if(enemies.aliveCount() < 10){
      enemies.spawnWaveAround(player.x, player.y, player.level);
    }
    waveTimer = Math.max(2.0, 3.1 - player.level*0.12);
  }

  // camera
  cam.update(dt, player.x, player.y);

  // death
  if(player.hp <= 0){
    state = STATE.DEAD;
    cam.kick(14, 0.25);
    return;
  }

  // win
  if(world.inPortal(player.x, player.y, player.r)){
    objective.win = true;
    state = STATE.WIN;
  }
}

function draw(fps){
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  if(state === STATE.START){
    drawStart();
    if(debugOn){
      debugEl.textContent = `STATE ${state}\nSCALE ${view.scale}x\nFPS ${fmt(fps,0)}\n`;
    }
    return;
  }

  ctx.save();
  ctx.scale(view.scale, view.scale);

  const { sx, sy } = cam.getShakeOffset();
  const camX = (cam.x + sx) | 0;
  const camY = (cam.y + sy) | 0;

  world.draw(ctx, camX, camY, tWorld);
  pickups.draw(ctx, camX, camY);
  drops.draw(ctx, camX, camY);
  enemies.draw(ctx, camX, camY);
  player.draw(ctx, camX, camY);

  drawHUD(ctx);

  if(state === STATE.WIN){
    overlayMessage("PORTAL BREACHED", "PRESS ENTER / TAP TO RUN IT BACK", "NEXT PART: REAL UI + FLOATING TEXT + MINI-MAP");
  }
  if(state === STATE.DEAD){
    overlayMessage("YOU DIED", "PRESS ENTER / TAP TO RESTART", "TIP: DASH THROUGH THEM, SLASH BACK");
  }

  ctx.restore();

  if(debugOn){
    const bossAlive = enemies?.list?.some(e=>e.boss && e.hp>0);
    debugEl.textContent =
      `STATE ${state}\n`+
      `SCALE ${view.scale}x\n`+
      `FPS ${fmt(fps,0)}\n`+
      `P ${player.x|0},${player.y|0}\n`+
      `HP ${player.hp|0}/${player.hpMax|0}\n`+
      `LV ${player.level} XP ${player.x|0}\n`+
      `SHARDS ${pickups.collected}/${pickups.target}\n`+
      `BOSS ${bossAlive?"ALIVE":"NO"}\n`+
      `PORTAL ${objective.portalOpen ? "OPEN" : "LOCKED"}\n`+
      `ENEMIES ${enemies.aliveCount()}\n`;
  }
}

function drawHUD(ctx){
  const pad = 10;

  // HP bar
  const barW = 150;
  const hp = player.hp / player.hpMax;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad, pad, barW, 10);
  ctx.fillStyle = "rgba(255,74,122,0.95)";
  ctx.fillRect(pad, pad, (barW*hp)|0, 10);

  // XP bar
  const xp = player.xp / player.xpNext;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad, pad+14, barW, 6);
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.fillRect(pad, pad+14, (barW*xp)|0, 6);

  // Text
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`LV ${player.level}`, pad, pad+34);

  // Objective
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad, pad+38, 190, 22);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(`SHARDS ${pickups.collected}/${pickups.target}`, pad+8, pad+52);

  const bossAlive = enemies.list.some(e=>e.boss && e.hp>0);
  const status = objective.portalOpen ? "PORTAL OPEN"
              : bossAlive ? "KILL THE BOSS"
              : pickups.done() ? "PORTAL UNLOCKING"
              : "FIND SHARDS";

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(CONFIG.baseW-160-pad, pad, 160, 22);

  ctx.fillStyle = objective.portalOpen ? "rgba(125,255,177,0.90)" : "rgba(255,255,255,0.65)";
  ctx.fillText(status, CONFIG.baseW-pad-8, pad+14);

  // Portal compass
  const dx = world.portal.x - player.x;
  const dy = world.portal.y - player.y;
  const ang = Math.atan2(dy, dx);
  const cx = CONFIG.baseW/2;
  const cy = 14;
  const px = (cx + Math.cos(ang)*8)|0;
  const py = (cy + Math.sin(ang)*5)|0;

  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.fillRect(cx-10, cy-4, 20, 8);
  ctx.fillStyle = objective.portalOpen ? "rgba(138,46,255,0.95)" : "rgba(255,255,255,0.55)";
  ctx.fillRect(px, py, 2, 2);
}

function overlayMessage(title, sub, foot){
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,CONFIG.baseW,CONFIG.baseH);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(title, CONFIG.baseW/2, 78);

  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(sub, CONFIG.baseW/2, 104);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(foot || "", CONFIG.baseW/2, 126);
}

function drawStart(){
  ctx.save();
  ctx.scale(view.scale, view.scale);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,CONFIG.baseW,CONFIG.baseH);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", CONFIG.baseW/2, 66);

  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("PART 4: COMBAT ONLINE", CONFIG.baseW/2, 90);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START", CONFIG.baseW/2, 116);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("SLASH (J/SPACE) • DASH (K/SHIFT) • COLLECT 3 SHARDS", CONFIG.baseW/2, 136);

  ctx.restore();
}
