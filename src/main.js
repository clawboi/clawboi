import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { Camera } from "./camera.js";
import { PickupManager } from "./pickups.js";

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
const STATE = { START:"start", PLAY:"play", WIN:"win" };
let state = STATE.START;

let world = null;
let player = null;
let cam = null;
let pickups = null;

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

  // spawn shards near open tiles around spawn (guaranteed reachable-ish)
  // simple: place them by sampling until floor found
  for(let i=0;i<objective.shardsNeeded;i++){
    const p = findOpenSpot(world, world.spawn.x, world.spawn.y, 220 + i*80);
    pickups.addShard(p.x, p.y);
  }

  objective.portalOpen = false;
  objective.win = false;
  world.setPortalActive(false);

  state = STATE.PLAY;
}

function findOpenSpot(world, cx, cy, radius){
  for(let tries=0; tries<900; tries++){
    const a = Math.random()*Math.PI*2;
    const d = radius * (0.35 + Math.random()*0.65);
    const x = cx + Math.cos(a)*d;
    const y = cy + Math.sin(a)*d;
    if(!world.isBlockedCircle(x,y,10)) return {x:x|0,y:y|0};
  }
  // fallback: spawn
  return {x:cx|0,y:cy|0};
}

canvas.addEventListener("pointerdown", ()=>{
  if(state === STATE.START) startGame();
  if(state === STATE.WIN) startGame();
}, { passive:true });

window.addEventListener("keydown", (e)=>{
  const k = (e.key||"").toLowerCase();
  if(state === STATE.START && (k==="enter" || k===" ")) startGame();
  if(state === STATE.WIN && (k==="enter" || k===" ")) startGame();
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

function update(dt){
  if(state === STATE.START || state === STATE.WIN) return;

  tWorld += dt;

  // dash
  if(input.dash()) player.tryDash();

  // movement + collision
  player.update(dt, input, world);

  // pickups
  pickups.update(dt);
  const got = pickups.tryCollect(player);
  if(got){
    if(cam) cam.kick(2.5, 0.10);
  }

  // objective logic
  if(!objective.portalOpen && pickups.done()){
    objective.portalOpen = true;
    world.setPortalActive(true);
    if(cam) cam.kick(6, 0.18);
  }

  // camera follow
  cam.update(dt, player.x, player.y);

  // win check
  if(world.inPortal(player.x, player.y, player.r)){
    objective.win = true;
    state = STATE.WIN;
  }
}

function draw(fps){
  // clear screen
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // start overlay
  if(state === STATE.START){
    drawStart();
    if(debugOn){
      debugEl.textContent =
        `STATE ${state}\nSCALE ${view.scale}x\nFPS ${fmt(fps,0)}\n`;
    }
    return;
  }

  // base-space render
  ctx.save();
  ctx.scale(view.scale, view.scale);

  const { sx, sy } = cam.getShakeOffset();
  const camX = (cam.x + sx) | 0;
  const camY = (cam.y + sy) | 0;

  world.draw(ctx, camX, camY, tWorld);
  pickups.draw(ctx, camX, camY);
  player.draw(ctx, camX, camY);

  // HUD in base-space
  drawHUD(ctx);

  // win overlay
  if(state === STATE.WIN){
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,CONFIG.baseW,CONFIG.baseH);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("PORTAL BREACHED", CONFIG.baseW/2, 78);

    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("PRESS ENTER / TAP TO RUN IT BACK", CONFIG.baseW/2, 104);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("NEXT PART: COMBAT + ENEMIES + XP + LOOT", CONFIG.baseW/2, 124);
  }

  ctx.restore();

  if(debugOn){
    debugEl.textContent =
      `STATE ${state}\n`+
      `SCALE ${view.scale}x\n`+
      `FPS ${fmt(fps,0)}\n`+
      `P ${player.x|0},${player.y|0}\n`+
      `CAM ${cam.x|0},${cam.y|0}\n`+
      `SHARDS ${pickups.collected}/${pickups.target}\n`+
      `PORTAL ${objective.portalOpen ? "OPEN" : "LOCKED"}\n`;
  }
}

function drawHUD(ctx){
  // top-left objective
  const pad = 10;

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad, pad, 148, 26);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("OBJECTIVE", pad+8, pad+11);

  const shardText = `VIOLET SHARDS ${pickups.collected}/${pickups.target}`;
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.fillText(shardText, pad+8, pad+22);

  // portal status
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(CONFIG.baseW-152-pad, pad, 152, 26);

  ctx.fillStyle = objective.portalOpen ? "rgba(125,255,177,0.90)" : "rgba(255,255,255,0.65)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(objective.portalOpen ? "PORTAL: OPEN" : "PORTAL: LOCKED", CONFIG.baseW-pad-8, pad+16);

  // mini compass pip (points to portal)
  const dx = world.portal.x - player.x;
  const dy = world.portal.y - player.y;
  const ang = Math.atan2(dy, dx);
  const cx = CONFIG.baseW/2;
  const cy = 14;
  const px = (cx + Math.cos(ang)*8)|0;
  const py = (cy + Math.sin(ang)*5)|0;

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(cx-10, cy-4, 20, 8);
  ctx.fillStyle = objective.portalOpen ? "rgba(138,46,255,0.95)" : "rgba(255,255,255,0.55)";
  ctx.fillRect(px, py, 2, 2);
}

function drawStart(){
  ctx.save();
  ctx.scale(view.scale, view.scale);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,CONFIG.baseW,CONFIG.baseH);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", CONFIG.baseW/2, 70);

  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("PART 3: WORLD ONLINE", CONFIG.baseW/2, 92);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START", CONFIG.baseW/2, 118);

  ctx.fillStyle = "rgba(255,255,255,0.50)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("COLLECT 3 VIOLET SHARDS TO OPEN THE PORTAL", CONFIG.baseW/2, 136);

  ctx.restore();
}
