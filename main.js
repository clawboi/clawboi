import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { Camera } from "./camera.js";
import { PickupManager } from "./pickups.js";
import { EnemyManager } from "./enemies.js";
import { DropManager } from "./drops.js";
import { FX } from "./fx.js";

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
let fx = null;

let tWorld = 0;

// objective
const objective = {
  shardsNeeded: 3,
  portalOpen: false,
  win: false
};

// minimap cache
let mapCanvas = null;
let mapCtx = null;
let mapDirty = true;

function ensureMapCanvas(){
  if(mapCanvas) return;
  mapCanvas = document.createElement("canvas");
  mapCtx = mapCanvas.getContext("2d", { alpha:true });
}

// build minimap once per world
function rebuildMinimap(){
  ensureMapCanvas();
  mapDirty = false;

  // We try a few possible world formats. If missing, we still draw a fallback.
  const tilesW = world.tilesW ?? world.w ?? 0;
  const tilesH = world.tilesH ?? world.h ?? 0;
  const tiles = world.tiles ?? world.tile ?? null;

  // default small map size
  const MW = 96, MH = 72;
  mapCanvas.width = MW;
  mapCanvas.height = MH;

  mapCtx.clearRect(0,0,MW,MH);

  // background
  mapCtx.fillStyle = "rgba(0,0,0,0.35)";
  mapCtx.fillRect(0,0,MW,MH);

  if(tiles && tilesW>0 && tilesH>0){
    // downsample tiles onto MWxMH
    const sx = MW / tilesW;
    const sy = MH / tilesH;

    for(let y=0; y<tilesH; y++){
      for(let x=0; x<tilesW; x++){
        const i = x + y*tilesW;
        const t = tiles[i];
        if(t){
          // blocked
          mapCtx.fillStyle = "rgba(10,10,16,0.85)";
        }else{
          // floor
          mapCtx.fillStyle = ((x+y)&1) ? "rgba(12,32,23,0.75)" : "rgba(11,27,20,0.72)";
        }
        mapCtx.fillRect(x*sx, y*sy, sx+0.5, sy+0.5);
      }
    }

    // slight fog
    mapCtx.fillStyle = "rgba(138,46,255,0.06)";
    mapCtx.fillRect(0,0,MW,MH);
  }else{
    // fallback: just a nice frame
    mapCtx.strokeStyle = "rgba(138,46,255,0.35)";
    mapCtx.strokeRect(1,1,MW-2,MH-2);
    mapCtx.fillStyle = "rgba(255,255,255,0.25)";
    mapCtx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    mapCtx.textAlign = "center";
    mapCtx.fillText("MINIMAP", MW/2, MH/2);
  }

  // border
  mapCtx.strokeStyle = "rgba(138,46,255,0.55)";
  mapCtx.strokeRect(0.5,0.5,MW-1,MH-1);
}

/* ---------- start ---------- */
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

  fx = new FX();
  fx.reset();

  // shards around spawn
  for(let i=0;i<objective.shardsNeeded;i++){
    const p = findOpenSpot(world, world.spawn.x, world.spawn.y, 220 + i*90);
    pickups.addShard(p.x, p.y);
  }

  objective.portalOpen = false;
  objective.win = false;
  world.setPortalActive(false);

  // enemies
  enemies.spawnWaveAround(player.x, player.y, player.level);

  // minimap
  mapDirty = true;
  rebuildMinimap();

  state = STATE.PLAY;
  fx.text(player.x, player.y-10, "ENTER THE NODE", "violet");
  fx.pulseGood(0.22);
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
  fx.update(dt);

  // actions
  if(input.dash()){
    const ok = player.tryDash();
    if(ok){
      cam.kick(3.5, 0.10);
      fx.sparksHit(player.x, player.y, 8, "violet");
      fx.pulseGood(0.10);
    }
  }

  if(input.attack()){
    const ok = player.tryAttack();
    if(ok){
      cam.kick(1.8, 0.06);
      fx.sparksHit(player.x + player.face.x*10, player.y + player.face.y*10, 10, "violet");
    }
  }

  // movement + collision
  player.update(dt, input, world);

  // enemies update
  enemies.update(dt, player, world);

  // resolve player attack
  const hb = player.getHitbox();
  const res = enemies.resolvePlayerHit(hb);
  if(res.hits){
    cam.kick(2.2 + res.hits*0.4, 0.08);
    fx.hitFlash(0.12);
    fx.sparksHit(hb.x, hb.y, 16 + res.hits*3, "violet");
    fx.text(hb.x, hb.y-8, `HIT x${res.hits}`, "violet");
  }

  if(res.kills){
    // drop essence + XP
    drops.spawnEssence(hb.x, hb.y, 8 + res.kills*4);
    const xpGain = res.kills * 10;
    player.addXP(xpGain);
    fx.text(player.x, player.y-16, `+${xpGain} XP`, "good");
    fx.pulseGood(0.18);
  }

  // drops
  drops.update(dt, world);
  const got = drops.tryCollect(player);
  if(got){
    player.heal(got * 2);
    player.addXP(got * 1);
    fx.burst(player.x, player.y, 10);
    fx.text(player.x, player.y-12, `+${got*2} HP`, "good");
  }

  // shards
  pickups.update(dt);
  const gotShard = pickups.tryCollect(player);
  if(gotShard){
    cam.kick(6.0, 0.14);
    fx.hitFlash(0.14);
    fx.burst(player.x, player.y-6, 14);
    fx.text(player.x, player.y-18, "SHARD +1", "violet");

    // boss after shard 2
    if(pickups.collected === 2){
      enemies.spawnBoss(player.x, player.y, player.level);
      cam.kick(12, 0.20);
      fx.pulseDamage(0.20);
      fx.text(player.x, player.y-24, "BOSS EMERGES", "danger");
    }
  }

  // portal open condition
  const bossAlive = enemies.list.some(e=>e.boss && e.hp>0);
  const canOpen = pickups.done() && !bossAlive;

  if(!objective.portalOpen && canOpen){
    objective.portalOpen = true;
    world.setPortalActive(true);
    cam.kick(10, 0.18);
    fx.pulseGood(0.22);
    fx.text(world.portal.x, world.portal.y-10, "PORTAL OPEN", "good");
  }

  // waves
  waveTimer -= dt;
  if(waveTimer <= 0){
    if(enemies.aliveCount() < 11){
      enemies.spawnWaveAround(player.x, player.y, player.level);
      fx.text(player.x, player.y-26, "SHADOWS APPROACH", "");
    }
    waveTimer = Math.max(2.0, 3.1 - player.level*0.12);
  }

  // camera
  cam.update(dt, player.x, player.y);

  // death
  if(player.hp <= 0){
    state = STATE.DEAD;
    cam.kick(16, 0.25);
    fx.pulseDamage(0.35);
    fx.hitFlash(0.18);
    return;
  }

  // win
  if(world.inPortal(player.x, player.y, player.r)){
    objective.win = true;
    state = STATE.WIN;
    fx.pulseGood(0.30);
    fx.hitFlash(0.14);
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

  // world
  world.draw(ctx, camX, camY, tWorld);
  pickups.draw(ctx, camX, camY);
  drops.draw(ctx, camX, camY);
  enemies.draw(ctx, camX, camY);
  player.draw(ctx, camX, camY);

  // world FX (sparks + floaters)
  fx.drawWorld(ctx, camX, camY);

  // HUD
  drawHUD(ctx);

  // overlays
  fx.drawOverlay(ctx, CONFIG.baseW, CONFIG.baseH);

  if(state === STATE.WIN){
    overlayMessage("PORTAL BREACHED", "PRESS ENTER / TAP TO RUN IT BACK", "NEXT: REAL QUESTS + INTERACT + CHESTS");
  }
  if(state === STATE.DEAD){
    overlayMessage("YOU DIED", "PRESS ENTER / TAP TO RESTART", "DASH THROUGH THEM • SLASH BACK");
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

  // Left panel
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad-2, pad-2, 176, 58);

  // HP
  const barW = 156;
  const hp = player.hp / player.hpMax;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad+6, pad+6, barW, 10);
  ctx.fillStyle = "rgba(255,74,122,0.95)";
  ctx.fillRect(pad+6, pad+6, (barW*hp)|0, 10);

  // XP
  const xp = player.xp / player.xpNext;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad+6, pad+20, barW, 6);
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.fillRect(pad+6, pad+20, (barW*xp)|0, 6);

  // Level text
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`LV ${player.level}`, pad+6, pad+40);

  // Objective line
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`SHARDS ${pickups.collected}/${pickups.target}`, pad+60, pad+40);

  // Right panel (status + minimap)
  const rightW = 112;
  const rightX = CONFIG.baseW - rightW - pad;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(rightX, pad-2, rightW, 90);

  const bossAlive = enemies.list.some(e=>e.boss && e.hp>0);
  const status = objective.portalOpen ? "PORTAL OPEN"
              : bossAlive ? "KILL BOSS"
              : pickups.done() ? "UNLOCKING"
              : "FIND SHARDS";

  ctx.textAlign = "center";
  ctx.fillStyle = objective.portalOpen ? "rgba(125,255,177,0.90)" : "rgba(255,255,255,0.70)";
  ctx.fillText(status, rightX + rightW/2, pad+12);

  // minimap draw (cached) + live markers
  if(mapDirty) rebuildMinimap();

  // map frame area
  const mx = rightX + 8;
  const my = pad + 18;
  const MW = 96, MH = 72;

  // map image
  ctx.drawImage(mapCanvas, mx, my);

  // markers (convert world coords -> map coords)
  const tilesW = world.tilesW ?? world.w ?? 1;
  const tilesH = world.tilesH ?? world.h ?? 1;
  const tileSize = world.tileSize ?? 8;

  const wx = player.x / (tilesW*tileSize);
  const wy = player.y / (tilesH*tileSize);

  // player
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(mx + (wx*MW)|0, my + (wy*MH)|0, 2, 2);

  // portal
  if(world.portal){
    const px = world.portal.x / (tilesW*tileSize);
    const py = world.portal.y / (tilesH*tileSize);
    ctx.fillStyle = objective.portalOpen ? "rgba(138,46,255,0.95)" : "rgba(255,255,255,0.45)";
    ctx.fillRect(mx + (px*MW)|0, my + (py*MH)|0, 2, 2);
  }

  // enemies (tiny dots)
  let shown = 0;
  ctx.fillStyle = "rgba(255,74,122,0.55)";
  for(const e of enemies.list){
    if(e.hp<=0) continue;
    if(shown++ > 18) break;
    const ex = e.x / (tilesW*tileSize);
    const ey = e.y / (tilesH*tileSize);
    ctx.fillRect(mx + (ex*MW)|0, my + (ey*MH)|0, 1, 1);
  }
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
  ctx.fillText("PART 5: JUICE + MINIMAP", CONFIG.baseW/2, 90);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START", CONFIG.baseW/2, 116);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("SLASH (J/SPACE) • DASH (K/SHIFT) • GET 3 SHARDS • KILL BOSS", CONFIG.baseW/2, 136);

  ctx.restore();
}
