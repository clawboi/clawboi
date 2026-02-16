import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { WorldNode } from "./world_node.js";
import { Camera } from "./camera.js";
import { PickupManager } from "./pickups.js";
import { EnemyManager } from "./enemies.js";
import { DropManager } from "./drops.js";
import { FX } from "./fx.js";
import { Quest } from "./quest.js";
import { Interactables } from "./interactables.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha:false });

const debugEl = document.getElementById("debug");
let debugOn = false;

// IMPORTANT: declare cam BEFORE resize() is ever called (fix TDZ crash)
let cam = null;

const mobileAtkBtn = document.getElementById("mAtk");
const mobileDashBtn = document.getElementById("mDash");

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

  // guard: cam may not exist yet
  if(cam && cam.resizeView) cam.resizeView(CONFIG.baseW, CONFIG.baseH);
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

// INTERACT pressed flag (E key) independent of Input to avoid breaking your old input.js
let interactPressed = false;
window.addEventListener("keydown", (e)=>{
  const k = (e.key||"").toLowerCase();
  if(k === "e") interactPressed = true;
}, {passive:true});

/* ---------- state ---------- */
const STATE = { START:"start", PLAY:"play", WIN:"win", DEAD:"dead" };
let state = STATE.START;

let world = null;
let forest = null;
let node = null;

let player = null;
let pickups = null;
let enemies = null;
let drops = null;
let fx = null;

let quest = null;
let interact = null;

// room
let room = "forest"; // "forest" | "node"

// minimap cache
let mapCanvas = null;
let mapCtx = null;
let mapDirty = true;

function ensureMapCanvas(){
  if(mapCanvas) return;
  mapCanvas = document.createElement("canvas");
  mapCtx = mapCanvas.getContext("2d", { alpha:true });
}

function rebuildMinimap(){
  ensureMapCanvas();
  mapDirty = false;

  const tilesW = world.tilesW ?? world.w ?? 0;
  const tilesH = world.tilesH ?? world.h ?? 0;
  const tiles = world.tiles ?? world.tile ?? null;

  const MW = 96, MH = 72;
  mapCanvas.width = MW;
  mapCanvas.height = MH;

  mapCtx.clearRect(0,0,MW,MH);
  mapCtx.fillStyle = "rgba(0,0,0,0.35)";
  mapCtx.fillRect(0,0,MW,MH);

  if(tiles && tilesW>0 && tilesH>0){
    const sx = MW / tilesW;
    const sy = MH / tilesH;

    for(let y=0; y<tilesH; y++){
      for(let x=0; x<tilesW; x++){
        const i = x + y*tilesW;
        const t = tiles[i];
        if(t){
          mapCtx.fillStyle = "rgba(10,10,16,0.85)";
        }else{
          mapCtx.fillStyle = ((x+y)&1) ? "rgba(12,32,23,0.75)" : "rgba(11,27,20,0.72)";
        }
        mapCtx.fillRect(x*sx, y*sy, sx+0.5, sy+0.5);
      }
    }
    mapCtx.fillStyle = "rgba(138,46,255,0.06)";
    mapCtx.fillRect(0,0,MW,MH);
  }else{
    mapCtx.strokeStyle = "rgba(138,46,255,0.35)";
    mapCtx.strokeRect(1,1,MW-2,MH-2);
    mapCtx.fillStyle = "rgba(255,255,255,0.25)";
    mapCtx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    mapCtx.textAlign = "center";
    mapCtx.fillText("MINIMAP", MW/2, MH/2);
  }

  mapCtx.strokeStyle = "rgba(138,46,255,0.55)";
  mapCtx.strokeRect(0.5,0.5,MW-1,MH-1);
}

function startGame(){
  // worlds
  forest = new WorldForest({
    tilesW: 160,
    tilesH: 120,
    tileSize: 8,
    seed: (Math.random()*1e9)|0
  });
  node = new WorldNode();

  // start in forest
  world = forest;
  room = "forest";

  player = new PlayerTest(world.spawn.x, world.spawn.y);

  cam = new Camera({
    viewW: CONFIG.baseW,
    viewH: CONFIG.baseH,
    worldW: world.worldW,
    worldH: world.worldH
  });

  // NOW that cam exists, resize safely (optional but nice)
  resize();

  pickups = new PickupManager();
  pickups.reset(3);

  enemies = new EnemyManager(world);
  enemies.reset();

  drops = new DropManager();
  drops.reset();

  fx = new FX();
  fx.reset();

  quest = new Quest();
  quest.reset();

  interact = new Interactables();
  interact.reset();

  // place shards in forest
  for(let i=0;i<3;i++){
    const p = findOpenSpot(world, world.spawn.x, world.spawn.y, 220 + i*90);
    pickups.addShard(p.x, p.y);
  }

  // interactables in forest:
  // 1 note near spawn
  interact.add("note", world.spawn.x + 60, world.spawn.y + 10, {
    text: "THE FOREST IS A SIMULATION WITH TEETH.\nSHARDS ARE ITS EYES.\nTHE KEY REMEMBERS WHAT YOU FORGOT."
  });
  // 2 chest contains key
  const c = findOpenSpot(world, world.spawn.x, world.spawn.y, 320);
  interact.add("chest", c.x, c.y, { contains:"key" });

  // 3 locked gate blocking node entrance
  const g = findOpenSpot(world, world.spawn.x, world.spawn.y, 420);
  interact.add("gate", g.x, g.y, { locked:true });

  // 4 entrance behind gate (we’ll let it work even if layout is open)
  interact.add("entrance", g.x + 70, g.y, {});

  // enemies
  enemies.spawnWaveAround(player.x, player.y, player.level);

  fx.text(player.x, player.y-10, "E: INTERACT (NOTE/CHEST/GATE)", "violet");
  fx.pulseGood(0.20);

  mapDirty = true;
  rebuildMinimap();

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
let waveTimer = 0;
let tWorld = 0;

// simple inventory
const inv = { key:false };

function loop(t){
  const rawDt = (t - last)/1000;
  last = t;
  const dt = Math.min(CONFIG.dtCap, rawDt);

  const fps = dt>0 ? 1/dt : 0;
  fpsS = lerp(fpsS || fps, fps, 0.08);

  update(dt);
  draw(fpsS);

  input.endFrame();
  // clear interact press each frame (so it's a "tap")
  interactPressed = false;

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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

  // enemies
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
  }

  // quest: shards complete
  if(pickups.done()) quest.setShardsDone(true);

  // INTERACTION (E)
  const evt = interact.tryInteract(player, interactPressed);
  if(evt){
    if(evt.type === "note"){
      quest.done("read");
      fx.text(player.x, player.y-18, "NOTE READ", "violet");
      fx.pulseGood(0.18);
      // show a longer toast via floaters
      const msg = evt.obj.data?.text || "THE NOTE IS BLANK. THAT'S WORSE.";
      fx.text(player.x, player.y-30, msg.split("\n")[0], "");
      fx.text(player.x, player.y-40, msg.split("\n")[1] || "", "");
      fx.text(player.x, player.y-50, msg.split("\n")[2] || "", "");
    }

    if(evt.type === "chest"){
      fx.burst(evt.obj.x, evt.obj.y, 18);
      fx.hitFlash(0.12);
      if(evt.obj.data?.contains === "key"){
        // spawn key item right there
        interact.add("key", evt.obj.x + 18, evt.obj.y - 4, {});
        fx.text(player.x, player.y-18, "CHEST OPENED", "good");
      }else{
        fx.text(player.x, player.y-18, "CHEST EMPTY", "");
      }
    }

    if(evt.type === "key"){
      inv.key = true;
      quest.done("key");
      fx.text(player.x, player.y-18, "KEY ACQUIRED", "good");
      fx.pulseGood(0.22);
    }

    if(evt.type === "gate"){
      if(!inv.key){
        fx.text(player.x, player.y-18, "NEED KEY", "danger");
        fx.pulseDamage(0.18);
      }else{
        evt.obj.data.locked = false;
        quest.done("gate");
        fx.text(player.x, player.y-18, "GATE OPENED", "good");
        fx.hitFlash(0.10);
        fx.pulseGood(0.18);
      }
    }

    if(evt.type === "entrance"){
      // only allow if gate opened OR shards done (so it’s not soft-locked)
      const gateOk = quest.isDone("gate") || pickups.done();
      if(!gateOk){
        fx.text(player.x, player.y-18, "FOREST RESISTS", "danger");
        fx.pulseDamage(0.14);
      }else{
        enterNode();
      }
    }

    if(evt.type === "exit"){
      exitNode();
    }
  }

  // spawn waves (lighter in node)
  waveTimer -= dt;
  if(waveTimer <= 0){
    const cap = (room==="node") ? 6 : 11;
    if(enemies.aliveCount() < cap){
      enemies.spawnWaveAround(player.x, player.y, player.level);
      fx.text(player.x, player.y-26, room==="node" ? "NODE ECHOES…" : "SHADOWS APPROACH", "");
    }
    waveTimer = (room==="node")
      ? Math.max(2.6, 3.6 - player.level*0.10)
      : Math.max(2.0, 3.1 - player.level*0.12);
  }

  // camera
  cam.worldW = world.worldW;
  cam.worldH = world.worldH;
  cam.update(dt, player.x, player.y);

  // death
  if(player.hp <= 0){
    state = STATE.DEAD;
    cam.kick(16, 0.25);
    fx.pulseDamage(0.35);
    fx.hitFlash(0.18);
    return;
  }

  // node win condition: touch node portal then exit to forest
  if(room==="node" && world.inPortal(player.x, player.y, player.r)){
    quest.done("exit");
    fx.text(player.x, player.y-18, "NODE COMPLETE", "good");
    fx.pulseGood(0.25);
    exitNode();
  }

  // full win (optional): complete node exit
  if(quest.isDone("exit")){
    state = STATE.WIN;
    fx.pulseGood(0.30);
    fx.hitFlash(0.14);
  }
}

function enterNode(){
  room = "node";
  world = node;

  // reset enemies to node world
  enemies = new EnemyManager(world);
  enemies.reset();
  enemies.spawnWaveAround(world.spawn.x, world.spawn.y, player.level);

  // interactables for node
  interact.reset();
  interact.add("exit", world.portal.x, world.portal.y + 20, {});
  quest.done("node");

  // move player
  player.x = world.spawn.x;
  player.y = world.spawn.y;

  // camera
  cam.x = clamp(player.x - CONFIG.baseW/2, 0, world.worldW - CONFIG.baseW);
  cam.y = clamp(player.y - CONFIG.baseH/2, 0, world.worldH - CONFIG.baseH);

  mapDirty = true;
  rebuildMinimap();

  fx.text(player.x, player.y-18, "ENTERED NODE", "violet");
  fx.hitFlash(0.12);
  fx.pulseGood(0.18);
}

function exitNode(){
  room = "forest";
  world = forest;

  // enemies back to forest
  enemies = new EnemyManager(world);
  enemies.reset();
  enemies.spawnWaveAround(player.x, player.y, player.level);

  // restore forest interactables
  interact.reset();

  // note + chest + gate + entrance again (gate stays opened if quest done)
  interact.add("note", world.spawn.x + 60, world.spawn.y + 10, {
    text: "THE FOREST IS A SIMULATION WITH TEETH.\nSHARDS ARE ITS EYES.\nTHE KEY REMEMBERS WHAT YOU FORGOT."
  });
  const c = findOpenSpot(world, world.spawn.x, world.spawn.y, 320);
  interact.add("chest", c.x, c.y, { contains:"key" });

  const g = findOpenSpot(world, world.spawn.x, world.spawn.y, 420);
  interact.add("gate", g.x, g.y, { locked: !quest.isDone("gate") });
  interact.add("entrance", g.x + 70, g.y, {});

  // place player near spawn
  player.x = world.spawn.x;
  player.y = world.spawn.y;

  cam.x = clamp(player.x - CONFIG.baseW/2, 0, world.worldW - CONFIG.baseW);
  cam.y = clamp(player.y - CONFIG.baseH/2, 0, world.worldH - CONFIG.baseH);

  mapDirty = true;
  rebuildMinimap();

  fx.text(player.x, player.y-18, "BACK TO FOREST", "");
  fx.pulseGood(0.10);
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

  // draw shards only in forest
  if(room==="forest") pickups.draw(ctx, camX, camY);

  drops.draw(ctx, camX, camY);
  enemies.draw(ctx, camX, camY);
  interact.draw(ctx, camX, camY);
  player.draw(ctx, camX, camY);

  // FX (world)
  fx.drawWorld(ctx, camX, camY);

  // HUD
  drawHUD(ctx);

  // overlay FX
  fx.drawOverlay(ctx, CONFIG.baseW, CONFIG.baseH);

  if(state === STATE.WIN){
    overlayMessage("REALM CLEARED", "PRESS ENTER / TAP TO RESTART", "PART 6: QUESTS + INTERACT + NODE COMPLETE");
  }
  if(state === STATE.DEAD){
    overlayMessage("YOU DIED", "PRESS ENTER / TAP TO RESTART", "DASH THROUGH THEM • SLASH BACK");
  }

  ctx.restore();

  if(debugOn){
    debugEl.textContent =
      `STATE ${state}\nROOM ${room}\nSCALE ${view.scale}x\nFPS ${fmt(fps,0)}\n`+
      `P ${player.x|0},${player.y|0}\nHP ${player.hp|0}/${player.hpMax|0}\n`+
      `SHARDS ${pickups.collected}/3\nKEY ${inv.key?"YES":"NO"}\n`;
  }
}

function drawHUD(ctx){
  const pad = 10;

  // Left panel
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(pad-2, pad-2, 196, 76);

  // HP
  const barW = 176;
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

  // text row
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`LV ${player.level}`, pad+6, pad+40);
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.fillText(`ROOM: ${room.toUpperCase()}`, pad+60, pad+40);

  // inventory
  ctx.fillStyle = inv.key ? "rgba(125,255,177,0.85)" : "rgba(255,255,255,0.40)";
  ctx.fillText(inv.key ? "KEY: YES" : "KEY: NO", pad+6, pad+54);

  // interact prompt
  if(interact.prompt){
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(interact.prompt, pad+60, pad+54);
  }

  // Right panel (minimap + quest list)
  const rightW = 132;
  const rightX = CONFIG.baseW - rightW - pad;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(rightX, pad-2, rightW, 154);

  // minimap
  if(mapDirty) rebuildMinimap();
  const mx = rightX + 18;
  const my = pad + 6;
  const MW = 96, MH = 72;
  ctx.drawImage(mapCanvas, mx, my);

  // markers
  const tilesW = world.tilesW ?? world.w ?? 1;
  const tilesH = world.tilesH ?? world.h ?? 1;
  const tileSize = world.tileSize ?? 8;

  const wx = player.x / (tilesW*tileSize);
  const wy = player.y / (tilesH*tileSize);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(mx + (wx*MW)|0, my + (wy*MH)|0, 2, 2);

  // portal marker (node uses inPortal)
  if(world.portal){
    const px = world.portal.x / (tilesW*tileSize);
    const py = world.portal.y / (tilesH*tileSize);
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.fillRect(mx + (px*MW)|0, my + (py*MH)|0, 2, 2);
  }

  // quest log
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("QUEST", rightX + 10, pad + 92);

  let y = pad + 104;
  for(const s of quest.list()){
    const done = s.done;
    ctx.fillStyle = done ? "rgba(125,255,177,0.78)" : "rgba(255,255,255,0.55)";
    ctx.fillText(`${done ? "✓" : "·"} ${s.text}`, rightX + 10, y);
    y += 12;
    if(y > pad + 150) break;
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
  ctx.fillText("PART 6: INTERACT + QUESTS + NODE", CONFIG.baseW/2, 90);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START", CONFIG.baseW/2, 116);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("E = INTERACT • J/SPACE = SLASH • K/SHIFT = DASH", CONFIG.baseW/2, 136);

  ctx.restore();
}
