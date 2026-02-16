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
const ctx = canvas.getContext("2d", { alpha: false });

const debugEl = document.getElementById("debug");
let debugOn = false;

// IMPORTANT: cam declared BEFORE resize() can run (prevents TDZ crash)
let cam = null;

const mobileAtkBtn = document.getElementById("mAtk");
const mobileDashBtn = document.getElementById("mDash");

const view = { scale: CONFIG.minScale, pxW: 0, pxH: 0 };

function calcScale(){
  const vv = window.visualViewport;
  const ww = vv ? vv.width  : window.innerWidth;
  const wh = vv ? vv.height : window.innerHeight;

  const sx = Math.floor(ww / CONFIG.baseW);
  const sy = Math.floor(wh / CONFIG.baseH);

  // leave a tiny safety margin so Safari UI bars don’t force scale down
  const s = Math.min(sx, sy) || CONFIG.minScale;
  return clamp(s, CONFIG.minScale, CONFIG.maxScale);
}

/**
 * ✅ FIX: Keep internal canvas at BASE resolution always.
 * Scale ONLY via CSS. This prevents "giant minimap / whole map" double-scaling.
 */
function resize() {
  view.scale = calcScale();
  view.pxW = CONFIG.baseW * view.scale;
  view.pxH = CONFIG.baseH * view.scale;

  // internal render resolution
  canvas.width = CONFIG.baseW;
  canvas.height = CONFIG.baseH;

  // display size
  canvas.style.width = view.pxW + "px";
  canvas.style.height = view.pxH + "px";

  ctx.imageSmoothingEnabled = false;

  if (cam && cam.resizeView) cam.resizeView(CONFIG.baseW, CONFIG.baseH);
}
window.addEventListener("resize", resize, { passive: true });
resize();

/* ---------- debug toggle ---------- */
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "`") {
      debugOn = !debugOn;
      debugEl.style.display = debugOn ? "block" : "none";
    }
  },
  { passive: true }
);

/* ---------- input ---------- */
const input = new Input({ canvas, mobileAtkBtn, mobileDashBtn });

// INTERACT pressed flag (E key) independent of Input
let interactPressed = false;
window.addEventListener(
  "keydown",
  (e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "e") interactPressed = true;
  },
  { passive: true }
);

/* ---------- state ---------- */
const STATE = { START: "start", PLAY: "play", WIN: "win", DEAD: "dead" };
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

function ensureMapCanvas() {
  if (mapCanvas) return;
  mapCanvas = document.createElement("canvas");
  mapCtx = mapCanvas.getContext("2d", { alpha: true });
}

function rebuildMinimap() {
  ensureMapCanvas();
  mapDirty = false;

  const tilesW = world?.tilesW ?? world?.w ?? 0;
  const tilesH = world?.tilesH ?? world?.h ?? 0;
  const tiles = world?.tiles ?? world?.tile ?? null;

  const MW = 96,
    MH = 72;
  mapCanvas.width = MW;
  mapCanvas.height = MH;

  mapCtx.clearRect(0, 0, MW, MH);
  mapCtx.fillStyle = "rgba(0,0,0,0.35)";
  mapCtx.fillRect(0, 0, MW, MH);

  if (tiles && tilesW > 0 && tilesH > 0) {
    const sx = MW / tilesW;
    const sy = MH / tilesH;

    for (let y = 0; y < tilesH; y++) {
      for (let x = 0; x < tilesW; x++) {
        const i = x + y * tilesW;
        const t = tiles[i];
        if (t) {
          mapCtx.fillStyle = "rgba(10,10,16,0.85)";
        } else {
          mapCtx.fillStyle =
            (x + y) & 1 ? "rgba(12,32,23,0.75)" : "rgba(11,27,20,0.72)";
        }
        mapCtx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
      }
    }

    mapCtx.fillStyle = "rgba(138,46,255,0.06)";
    mapCtx.fillRect(0, 0, MW, MH);
  } else {
    mapCtx.strokeStyle = "rgba(138,46,255,0.35)";
    mapCtx.strokeRect(1, 1, MW - 2, MH - 2);
    mapCtx.fillStyle = "rgba(255,255,255,0.25)";
    mapCtx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    mapCtx.textAlign = "center";
    mapCtx.fillText("MINIMAP", MW / 2, MH / 2);
  }

  mapCtx.strokeStyle = "rgba(138,46,255,0.55)";
  mapCtx.strokeRect(0.5, 0.5, MW - 1, MH - 1);
}

/* ---------- hit-stop (safe, no ui/effects deps) ---------- */
let hitStop = 0;
function doHitStop(t = 0.05) {
  hitStop = Math.max(hitStop, t);
}

/* ---------- fallback hitbox so enemies never become “invincible” ---------- */
let atkHB = null;
let atkHBt = 0;

function getAttackHB() {
  const hb = player?.getAttackHitbox?.();
  if (hb) return hb;
  if (atkHBt > 0 && atkHB) return atkHB;
  return null;
}

/* ---------- inventory ---------- */
const inv = { key: false };

/* ---------- game start ---------- */
function startGame() {
  forest = new WorldForest({
    tilesW: 160,
    tilesH: 120,
    tileSize: 8,
    seed: (Math.random() * 1e9) | 0,
  });

  node = new WorldNode();

  world = forest;
  room = "forest";

  player = new PlayerTest(world..x, world.spawn.y);

  cam = new Camera({
    viewW: CONFIG.baseW,
    viewH: CONFIG.baseH,
    worldW: world.worldW,
    worldH: world.worldH,
  });

  // now safe
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

  inv.key = false;

  // place shards in forest
  for (let i = 0; i < 3; i++) {
    const p = findOpenSpot(world, world.spawn.x, world.spawn.y, 220 + i * 90);
    pickups.addShard(p.x, p.y);
  }

  // interactables in forest
  interact.add("note", world.spawn.x + 60, world.spawn.y + 10, {
    text:
      "THE FOREST IS A SIMULATION WITH TEETH.\n" +
      "SHARDS ARE ITS EYES.\n" +
      "THE KEY REMEMBERS WHAT YOU FORGOT.",
  });

  const c = findOpenSpot(world, world.spawn.x, world.spawn.y, 320);
  interact.add("chest", c.x, c.y, { contains: "key" });

  const g = findOpenSpot(world, world.spawn.x, world.spawn.y, 420);
  interact.add("gate", g.x, g.y, { locked: true });
  interact.add("entrance", g.x + 70, g.y, {});

  // start enemies
  enemies.spawnWaveAround(player.x, player.y, player.level);

  fx.text(player.x, player.y - 10, "E: INTERACT (NOTE/CHEST/GATE)", "violet");
  fx.pulseGood(0.2);

  mapDirty = true;
  rebuildMinimap();

  state = STATE.PLAY;
}

function findOpenSpot(worldObj, cx, cy, radius) {
  for (let tries = 0; tries < 1200; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = radius * (0.35 + Math.random() * 0.65);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    if (!worldObj.isBlockedCircle(x, y, 10)) return { x: x | 0, y: y | 0 };
  }
  return { x: cx | 0, y: cy | 0 };
}

canvas.addEventListener(
  "pointerdown",
  () => {
    if (state === STATE.START || state === STATE.WIN || state === STATE.DEAD)
      startGame();
  },
  { passive: true }
);

window.addEventListener(
  "keydown",
  (e) => {
    const k = (e.key || "").toLowerCase();
    if (
      (state === STATE.START || state === STATE.WIN || state === STATE.DEAD) &&
      (k === "enter" || k === " ")
    )
      startGame();
  },
  { passive: true }
);

/* ---------- loop ---------- */
let last = now();
let fpsS = 0;
let waveTimer = 0;
let tWorld = 0;

function loop(t) {
  const rawDt = (t - last) / 1000;
  last = t;
  const dt = Math.min(CONFIG.dtCap, rawDt);

  const fps = dt > 0 ? 1 / dt : 0;
  fpsS = lerp(fpsS || fps, fps, 0.08);

  update(dt);
  draw(fpsS);

  input.endFrame();
  interactPressed = false;

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  if (state === STATE.START || state === STATE.WIN || state === STATE.DEAD)
    return;

  // tick fallback hitbox timer
  atkHBt = Math.max(0, atkHBt - dt);

  // hit-stop: freeze gameplay a tiny moment (fx still moves a bit)
  if (hitStop > 0) {
    hitStop = Math.max(0, hitStop - dt);
    fx.update(dt * 0.35);
    return;
  }

  tWorld += dt;
  fx.update(dt);

  // activate forest portal after shards
  if (room === "forest" && world?.setPortalActive) {
    world.setPortalActive(pickups.done());
  }

  // dash
  if (input.dash()) {
    const ok = player.tryDash();
    if (ok) {
      cam.kick(3.5, 0.1);
      fx.sparksHit(player.x, player.y, 8, "violet");
      fx.pulseGood(0.1);
    }
  }

  // attack
  if (input.attack()) {
    const ok = player.tryAttack();
    if (ok) {
      cam.kick(1.8, 0.06);

      const dirx = player.face?.x ?? 1;
      const diry = player.face?.y ?? 0;

      const fxX = player.x + dirx * 10;
      const fxY = player.y + diry * 10;
      fx.sparksHit(fxX, fxY, 10, "violet");

      // reliable fallback HB
      atkHB = {
        x: player.x + dirx * 14,
        y: player.y + diry * 14,
        r: 14,
        dmg: 14 + ((player.level | 0) * 2),
        kb: 220,
      };
      atkHBt = 0.09;
    }
  }

  // movement
  player.update(dt, input, world);

  // enemies
  enemies.update(dt, player, world);

  // resolve player hit vs enemies (supports BOTH APIs)
  const hb = getAttackHB();
  let hitCount = 0;
  let hitKills = 0;

  if (hb) {
    if (typeof enemies.resolvePlayerAttack === "function") {
      const h = enemies.resolvePlayerAttack(player, hb);
      hitCount = h?.count || 0;
      hitKills = h?.kills || 0;
    } else if (typeof enemies.resolvePlayerHit === "function") {
      const h = enemies.resolvePlayerHit(hb);
      // some versions return {hits,kills}
      hitCount = h?.hits || h?.count || 0;
      hitKills = h?.kills || 0;
    }
  }

  if (hitCount > 0) {
    cam.kick(2.6 + hitCount * 0.7, 0.09);
    if (fx.hitFlash) fx.hitFlash(0.1);
    doHitStop(0.03 + Math.min(0.03, hitCount * 0.01));

    if (hitKills > 0) {
      const xpGain = hitKills * 6;
      player.addXP(xpGain);
      fx.text(player.x, player.y - 10, `+${xpGain} XP`, "good");
      fx.pulseGood(0.16);
    }
  }

  // drops
  drops.update(dt, world);
  const got = drops.tryCollect(player);
  if (got) {
    player.heal(got * 2);
    player.addXP(got * 1);
    fx.burst(player.x, player.y, 10);
    fx.text(player.x, player.y - 12, `+${got * 2} HP`, "good");
  }

  // shards
  pickups.update(dt);
  const gotShard = pickups.tryCollect(player);
  if (gotShard) {
    cam.kick(6.0, 0.14);
    if (fx.hitFlash) fx.hitFlash(0.14);
    fx.burst(player.x, player.y - 6, 14);
    fx.text(player.x, player.y - 18, "SHARD +1", "violet");
    mapDirty = true;
  }

  if (pickups.done()) quest.setShardsDone(true);

  // interactions
  const evt = interact.tryInteract(player, interactPressed);
  if (evt) {
    if (evt.type === "note") {
      quest.done("read");
      fx.text(player.x, player.y - 18, "NOTE READ", "violet");
      fx.pulseGood(0.18);

      const msg = evt.obj.data?.text || "THE NOTE IS BLANK. THAT'S WORSE.";
      const lines = msg.split("\n");
      fx.text(player.x, player.y - 30, lines[0] || "", "");
      fx.text(player.x, player.y - 40, lines[1] || "", "");
      fx.text(player.x, player.y - 50, lines[2] || "", "");
    }

    if (evt.type === "chest") {
      fx.burst(evt.obj.x, evt.obj.y, 18);
      if (fx.hitFlash) fx.hitFlash(0.12);
      if (evt.obj.data?.contains === "key") {
        interact.add("key", evt.obj.x + 18, evt.obj.y - 4, {});
        fx.text(player.x, player.y - 18, "CHEST OPENED", "good");
      } else {
        fx.text(player.x, player.y - 18, "CHEST EMPTY", "");
      }
    }

    if (evt.type === "key") {
      inv.key = true;
      quest.done("key");
      fx.text(player.x, player.y - 18, "KEY ACQUIRED", "good");
      fx.pulseGood(0.22);
    }

    if (evt.type === "gate") {
      if (!inv.key) {
        fx.text(player.x, player.y - 18, "NEED KEY", "danger");
        fx.pulseDamage(0.18);
      } else {
        evt.obj.data.locked = false;
        quest.done("gate");
        fx.text(player.x, player.y - 18, "GATE OPENED", "good");
        if (fx.hitFlash) fx.hitFlash(0.1);
        fx.pulseGood(0.18);
      }
    }

    if (evt.type === "entrance") {
      const gateOk = quest.isDone("gate") || pickups.done();
      if (!gateOk) {
        fx.text(player.x, player.y - 18, "FOREST RESISTS", "danger");
        fx.pulseDamage(0.14);
      } else {
        enterNode();
      }
    }

    if (evt.type === "exit") {
      exitNode();
    }
  }

  // spawn waves (10s downtime after a wave is cleared)
waveTimer -= dt;

if (waveTimer <= 0) {
  // only spawn a new wave when the current one is cleared
  if (enemies.aliveCount() === 0) {
    enemies.spawnWaveAround(player.x, player.y, player.level);
    fx.text(player.x, player.y - 26, "WAVE INCOMING", "");
    waveTimer = 10; // <-- chill time after spawning the wave
  } else {
    waveTimer = 0.5; // recheck soon until wave is cleared
  }
}

  // camera follow
  cam.worldW = world.worldW;
  cam.worldH = world.worldH;
  cam.update(dt, player.x, player.y);

  // death
  if (player.hp <= 0) {
    state = STATE.DEAD;
    cam.kick(16, 0.25);
    fx.pulseDamage(0.35);
    if (fx.hitFlash) fx.hitFlash(0.18);
    return;
  }

  // node completion
  if (room === "node" && world.inPortal(player.x, player.y, player.r)) {
    quest.done("exit");
    fx.text(player.x, player.y - 18, "NODE COMPLETE", "good");
    fx.pulseGood(0.25);
    exitNode();
  }

  // full win
  if (quest.isDone("exit")) {
    state = STATE.WIN;
    fx.pulseGood(0.3);
    if (fx.hitFlash) fx.hitFlash(0.14);
  }
}

function enterNode() {
  room = "node";
  world = node;

  enemies = new EnemyManager(world);
  enemies.reset();
  enemies.spawnWaveAround(world.spawn.x, world.spawn.y, player.level);

  interact.reset();
  interact.add("exit", world.portal.x, world.portal.y + 20, {});
  quest.done("node");

  player.x = world.spawn.x;
  player.y = world.spawn.y;

  cam.x = clamp(player.x - CONFIG.baseW / 2, 0, world.worldW - CONFIG.baseW);
  cam.y = clamp(player.y - CONFIG.baseH / 2, 0, world.worldH - CONFIG.baseH);

  mapDirty = true;
  rebuildMinimap();

  fx.text(player.x, player.y - 18, "ENTERED NODE", "violet");
  if (fx.hitFlash) fx.hitFlash(0.12);
  fx.pulseGood(0.18);
}

function exitNode() {
  room = "forest";
  world = forest;

  enemies = new EnemyManager(world);
  enemies.reset();
  enemies.spawnWaveAround(player.x, player.y, player.level);

  interact.reset();

  interact.add("note", world.spawn.x + 60, world.spawn.y + 10, {
    text:
      "THE FOREST IS A SIMULATION WITH TEETH.\n" +
      "SHARDS ARE ITS EYES.\n" +
      "THE KEY REMEMBERS WHAT YOU FORGOT.",
  });

  const c = findOpenSpot(world, world.spawn.x, world.spawn.y, 320);
  interact.add("chest", c.x, c.y, { contains: "key" });

  const g = findOpenSpot(world, world.spawn.x, world.spawn.y, 420);
  interact.add("gate", g.x, g.y, { locked: !quest.isDone("gate") });
  interact.add("entrance", g.x + 70, g.y, {});

  player.x = world.spawn.x;
  player.y = world.spawn.y;

  cam.x = clamp(player.x - CONFIG.baseW / 2, 0, world.worldW - CONFIG.baseW);
  cam.y = clamp(player.y - CONFIG.baseH / 2, 0, world.worldH - CONFIG.baseH);

  mapDirty = true;
  rebuildMinimap();

  fx.text(player.x, player.y - 18, "BACK TO FOREST", "");
  fx.pulseGood(0.1);
}

function draw(fps) {
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state === STATE.START) {
    drawStart();
    if (debugOn) {
      debugEl.textContent = `STATE ${state}\nSCALE ${view.scale}x\nFPS ${fmt(
        fps,
        0
      )}\n`;
    }
    return;
  }

  ctx.save();

  const { sx, sy } = cam.getShakeOffset();
  const camX = (cam.x + sx) | 0;
  const camY = (cam.y + sy) | 0;

  world.draw(ctx, camX, camY, tWorld);

  if (room === "forest") pickups.draw(ctx, camX, camY);
  drops.draw(ctx, camX, camY);
  enemies.draw(ctx, camX, camY);
  interact.draw(ctx, camX, camY);
  player.draw(ctx, camX, camY);

  fx.drawWorld(ctx, camX, camY);

  drawHUD(ctx);

  fx.drawOverlay(ctx, CONFIG.baseW, CONFIG.baseH);

  if (state === STATE.WIN) {
    overlayMessage(
      "REALM CLEARED",
      "PRESS ENTER / TAP TO RESTART",
      "QUEST COMPLETE"
    );
  }
  if (state === STATE.DEAD) {
    overlayMessage("YOU DIED", "PRESS ENTER / TAP TO RESTART", "DASH • SLASH");
  }

  ctx.restore();

  if (debugOn) {
    debugEl.textContent =
      `STATE ${state}\nROOM ${room}\nSCALE ${view.scale}x\nFPS ${fmt(fps, 0)}\n` +
      `P ${player.x | 0},${player.y | 0}\nHP ${player.hp | 0}/${
        player.hpMax | 0
      }\n` +
      `SHARDS ${pickups.collected}/3\nKEY ${inv.key ? "YES" : "NO"}\n`;
  }
}

function drawHUD(ctx2) {
  const pad = 10;

  // left panel
  ctx2.fillStyle = "rgba(0,0,0,0.55)";
  ctx2.fillRect(pad - 2, pad - 2, 196, 76);

  // HP
  const barW = 176;
  const hp = player.hp / player.hpMax;
  ctx2.fillStyle = "rgba(0,0,0,0.55)";
  ctx2.fillRect(pad + 6, pad + 6, barW, 10);
  ctx2.fillStyle = "rgba(255,74,122,0.95)";
  ctx2.fillRect(pad + 6, pad + 6, (barW * hp) | 0, 10);

  // XP
  const xp = player.xp / player.xpNext;
  ctx2.fillStyle = "rgba(0,0,0,0.55)";
  ctx2.fillRect(pad + 6, pad + 20, barW, 6);
  ctx2.fillStyle = "rgba(138,46,255,0.95)";
  ctx2.fillRect(pad + 6, pad + 20, (barW * xp) | 0, 6);

  // text row
  ctx2.textAlign = "left";
  ctx2.fillStyle = "rgba(255,255,255,0.8)";
  ctx2.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx2.fillText(`LV ${player.level}`, pad + 6, pad + 40);
  ctx2.fillStyle = "rgba(255,255,255,0.6)";
  ctx2.fillText(`ROOM: ${room.toUpperCase()}`, pad + 60, pad + 40);

  // inventory
  ctx2.fillStyle = inv.key
    ? "rgba(125,255,177,0.85)"
    : "rgba(255,255,255,0.4)";
  ctx2.fillText(inv.key ? "KEY: YES" : "KEY: NO", pad + 6, pad + 54);

  // interact prompt
  if (interact.prompt) {
    ctx2.fillStyle = "rgba(255,255,255,0.85)";
    ctx2.fillText(interact.prompt, pad + 60, pad + 54);
  }

  // right panel
  const rightW = 132;
  const rightX = CONFIG.baseW - rightW - pad;

  ctx2.fillStyle = "rgba(0,0,0,0.55)";
  ctx2.fillRect(rightX, pad - 2, rightW, 154);

  // minimap
  if (mapDirty) rebuildMinimap();
  const mx = rightX + 18;
  const my = pad + 6;
  const MW = 96,
    MH = 72;
  ctx2.drawImage(mapCanvas, mx, my);

  // markers
  const tilesW = world.tilesW ?? world.w ?? 1;
  const tilesH = world.tilesH ?? world.h ?? 1;
  const tileSize = world.tileSize ?? 8;

  const wx = player.x / (tilesW * tileSize);
  const wy = player.y / (tilesH * tileSize);
  ctx2.fillStyle = "rgba(255,255,255,0.95)";
  ctx2.fillRect(mx + ((wx * MW) | 0), my + ((wy * MH) | 0), 2, 2);

  if (world.portal) {
    const px = world.portal.x / (tilesW * tileSize);
    const py = world.portal.y / (tilesH * tileSize);
    ctx2.fillStyle = "rgba(138,46,255,0.95)";
    ctx2.fillRect(mx + ((px * MW) | 0), my + ((py * MH) | 0), 2, 2);
  }

  // quest log
  ctx2.textAlign = "left";
  ctx2.fillStyle = "rgba(255,255,255,0.75)";
  ctx2.fillText("QUEST", rightX + 10, pad + 92);

  let y = pad + 104;
  for (const s of quest.list()) {
    const done = s.done;
    ctx2.fillStyle = done
      ? "rgba(125,255,177,0.78)"
      : "rgba(255,255,255,0.55)";
    ctx2.fillText(`${done ? "✓" : "·"} ${s.text}`, rightX + 10, y);
    y += 12;
    if (y > pad + 150) break;
  }
}

function overlayMessage(title, sub, foot) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CONFIG.baseW, CONFIG.baseH);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(title, CONFIG.baseW / 2, 78);

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(sub, CONFIG.baseW / 2, 104);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(foot || "", CONFIG.baseW / 2, 126);
}

function drawStart() {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CONFIG.baseW, CONFIG.baseH);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", CONFIG.baseW / 2, 66);

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("FOREST • QUESTS • NODE", CONFIG.baseW / 2, 90);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(
    isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START",
    CONFIG.baseW / 2,
    116
  );

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(
    "E = INTERACT • J/SPACE = SLASH • K/SHIFT = DASH",
    CONFIG.baseW / 2,
    136
  );

  ctx.restore();
}
