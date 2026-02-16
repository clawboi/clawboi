/* =========================================================
   MAIN — Game Loop + States + Camera + Spawning + Mobile
   - Start screen
   - Play state
   - Boss state (intro + simple arena lock)
   - Death screen + restart
   - Optimized canvas scaling (pixel sharp)
   ========================================================= */

import { Player } from "./player.js";
import { World } from "./world.js";
import { EnemyManager } from "./enemies.js";
import { Effects } from "./effects.js";
import { UIManager } from "./ui.js";

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
  scale: 4,          // auto-adjusted by resize
  maxScale: 6,
  minScale: 3,
  dtCap: 1 / 30,     // prevents giant jumps after tab-switch
};

let viewW = config.baseW * config.scale;
let viewH = config.baseH * config.scale;

function resize() {
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

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());

  // Start / Restart convenience
  if (state === STATE.START && (e.key === "Enter" || e.key === " ")) startGame();
  if (state === STATE.DEAD && (e.key === "Enter" || e.key === " ")) startGame();
}, { passive: false });

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

function isDown(k) { return keys.has(k); }

/* Mobile virtual stick + buttons (optional)
   If you don’t have these in HTML yet, this safely no-ops.
*/
const mobile = {
  stick: document.getElementById("stick"),
  knob: document.getElementById("knob"),
  btnA: document.getElementById("btnA"), // attack
  btnB: document.getElementById("btnB"), // dash
  active: false,
  ax: 0, ay: 0,
};

function setupMobile() {
  if (!mobile.stick || !mobile.knob) return;

  let sx = 0, sy = 0, dragging = false;

  const setAxes = (dx, dy) => {
    const r = 32; // knob radius
    const len = Math.hypot(dx, dy);
    const nx = len ? dx / len : 0;
    const ny = len ? dy / len : 0;
    const mag = Math.min(1, len / r);

    mobile.ax = nx * mag;
    mobile.ay = ny * mag;
    mobile.knob.style.transform = `translate(${Math.floor(nx * mag * r)}px, ${Math.floor(ny * mag * r)}px)`;
  };

  mobile.stick.addEventListener("pointerdown", (e) => {
    dragging = true;
    mobile.active = true;
    const rect = mobile.stick.getBoundingClientRect();
    sx = rect.left + rect.width / 2;
    sy = rect.top + rect.height / 2;
    setAxes(e.clientX - sx, e.clientY - sy);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setAxes(e.clientX - sx, e.clientY - sy);
  }, { passive: true });

  window.addEventListener("pointerup", () => {
    dragging = false;
    mobile.active = false;
    mobile.ax = 0; mobile.ay = 0;
    if (mobile.knob) mobile.knob.style.transform = `translate(0px,0px)`;
  }, { passive: true });

  if (mobile.btnA) {
    mobile.btnA.addEventListener("pointerdown", (e) => { keys.add("j"); e.preventDefault(); }, { passive: false });
    mobile.btnA.addEventListener("pointerup", () => keys.delete("j"), { passive: true });
    mobile.btnA.addEventListener("pointercancel", () => keys.delete("j"), { passive: true });
  }
  if (mobile.btnB) {
    mobile.btnB.addEventListener("pointerdown", (e) => { keys.add("k"); e.preventDefault(); }, { passive: false });
    mobile.btnB.addEventListener("pointerup", () => keys.delete("k"), { passive: true });
    mobile.btnB.addEventListener("pointercancel", () => keys.delete("k"), { passive: true });
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

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function camShake(power = 3, time = 0.15) {
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

function startGame() {
  world = new World({
    seed: Math.floor(Math.random() * 1e9),
    w: 256, h: 256,
  });

  player = new Player({
    x: world.spawnX,
    y: world.spawnY,
  });

  enemies = new EnemyManager(world);
  effects = new Effects();
  ui = new UIManager();

  spawnT = 0;
  bossGate.active = false;
  bossGate.nextAtLevel = 3;

  // UI hook
  ui.toast("ENTER THE FOREST NODE", "good");

  state = STATE.PLAY;
}

function spawnWave() {
  const base = 2 + Math.floor(player.level * 0.6);
  const extra = effects.hallucination > 0.2 ? 2 : 0;
  const count = Math.min(10, base + extra);

  for (let i = 0; i < count; i++) {
    const p = world.randomPointNear(player.x, player.y, 220, 420);
    enemies.spawnRandom(p.x, p.y, player.level);
  }
}

function maybeTriggerBoss() {
  if (bossGate.active) return;
  if (player.level < bossGate.nextAtLevel) return;

  bossGate.active = true;
  state = STATE.BOSS;

  camShake(7, 0.25);

  // UI hooks you asked for:
  ui.bossIntro(bossGate.bossName, "A FLOATING EYE THAT HATES YOUR BREATH");
  ui.toast("BOSS APPROACHING", "warn");

  // clear mobs, spawn boss
  enemies.clearAllNonBoss?.();
  enemies.spawnBoss?.(bossGate.bossId, player, world);

  // lock arena if your World supports it
  world.lockArena?.(player.x, player.y, 420);
}

/* ------------------ Update helpers ------------------ */
function getMoveInput() {
  let mx = 0, my = 0;

  if (isDown("a") || isDown("arrowleft")) mx -= 1;
  if (isDown("d") || isDown("arrowright")) mx += 1;
  if (isDown("w") || isDown("arrowup")) my -= 1;
  if (isDown("s") || isDown("arrowdown")) my += 1;

  if (mobile.active) { mx += mobile.ax; my += mobile.ay; }

  const len = Math.hypot(mx, my);
  if (len > 1e-6) { mx /= Math.max(1, len); my /= Math.max(1, len); }

  return { mx, my };
}

/* ------------------ Main update ------------------ */
function update(dt) {
  if (state === STATE.START) return;

  // allow UI/effects to animate even while dead
  if (state === STATE.DEAD) {
    ui?.update(dt, player, effects, enemies);
    effects?.update(dt, player, world);
    return;
  }

  // always tick these
  effects.update(dt, player, world);
  ui.update(dt, player, effects, enemies);

  const { mx, my } = getMoveInput();

  player.setMove(mx, my);

  const attacking = isDown("j") || isDown(" ");
  const dashing = isDown("k") || isDown("shift");

  if (attacking) player.tryAttack();
  if (dashing) player.tryDash();

  player.update(dt, world, effects);

  /* ---- pickups ---- */
  const pickup = world.tryPickup?.(player.x, player.y);
  if (pickup) {
    player.addItem?.(pickup);
    player.addXP?.(pickup.xp ?? 2);

    // UI hooks you asked for:
    if (pickup.kind === "crystal") ui.toast("Picked up Crystal", "good");
    if (pickup.kind === "mushroom") ui.toast("Picked up Mushroom", "good");
    if (pickup.kind === "potion") ui.toast("Picked up Potion", "good");

    if (pickup.kind === "mushroom" || pickup.kind === "potion") {
      effects.triggerHallucination?.(1.0);
      camShake(4, 0.12);
    }
  }

  /* ---- enemies ---- */
  enemies.update(dt, player, world, effects);

  // Player sword vs enemies
  const hit = enemies.resolvePlayerAttack?.(player);
  if (hit && hit.hits) {
    camShake(2 + Math.min(3, hit.hits), 0.08);
    effects.hitFlash?.(0.10);

    // float damage numbers at enemy positions if provided
    if (hit.floatTexts?.length) {
      for (const ft of hit.floatTexts) {
        // ft = {x,y,text,type}
        ui.floatText(ft.x, ft.y, ft.text, ft.type || "hit");
      }
    }
  }

  // Enemy hits vs player
  const took = enemies.resolveEnemyHits?.(player);
  if (took) {
    effects.damagePulse?.(0.22);
    camShake(5, 0.12);
    ui.toast("HIT", "bad");
  }

  // Level-up UI (supports either pattern)
  const leveled = player.didLevelUp?.();
  if (leveled) {
    ui.toast(`LEVEL UP → ${player.level}`, "good");
    camShake(6, 0.18);
  }

  // Spawn waves in PLAY only
  spawnT -= dt;
  if (spawnT <= 0 && state === STATE.PLAY) {
    spawnWave();
    spawnT = Math.max(1.6, 3.2 - player.level * 0.12);
  }

  maybeTriggerBoss();

  // Boss state exit if boss dead
  if (state === STATE.BOSS) {
    const bossAlive = enemies.hasBossAlive?.() ?? false;
    if (!bossAlive) {
      ui.toast("BOSS DEFEATED", "good");
      camShake(9, 0.25);

      world.unlockArena?.();
      bossGate.active = false;
      bossGate.nextAtLevel += 3;
      state = STATE.PLAY;
    }
  }

  // Camera follow (smooth)
  const follow = 1 - Math.pow(0.001, dt);
  camera.x += ((player.x - config.baseW / 2) - camera.x) * follow;
  camera.y += ((player.y - config.baseH / 2) - camera.y) * follow;

  // Clamp camera if world exposes bounds
  if (world.bounds) {
    camera.x = clamp(camera.x, 0, world.bounds.w - config.baseW);
    camera.y = clamp(camera.y, 0, world.bounds.h - config.baseH);
  }

  // Camera shake decay
  if (camera.shakeT > 0) {
    camera.shakeT -= dt;
    camera.shake *= 0.86;
    if (camera.shakeT <= 0) camera.shake = 0;
  }

  // Death
  if (player.hp <= 0 && state !== STATE.DEAD) {
    state = STATE.DEAD;
    camShake(10, 0.28);
    ui.toast("THE FOREST ATE YOU", "bad");
    ui.bossIntro("YOU DIED", "PRESS ENTER / TAP TO RESTART");
  }
}

/* ------------------ Render ------------------ */
function render() {
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // render world in base res, then scaled up
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(config.scale, config.scale);

  let sx = 0, sy = 0;
  if (camera.shake > 0) {
    sx = (Math.random() * 2 - 1) * camera.shake * 0.7;
    sy = (Math.random() * 2 - 1) * camera.shake * 0.7;
  }

  const camX = Math.floor(camera.x + sx);
  const camY = Math.floor(camera.y + sy);

  world?.draw(ctx, camX, camY, effects);
  enemies?.draw(ctx, camX, camY, effects);
  player?.draw(ctx, camX, camY, effects);

  effects?.drawOverlay?.(ctx, config.baseW, config.baseH);

  ctx.restore();

  // UI draws in screen pixels (full resolution)
  if (ui && player && effects && enemies) {
    ui.draw(ctx, canvas.width, canvas.height, camX, camY, player, effects, enemies);
  }

  // Start overlay
  if (state === STATE.START) drawStart();
}

/* ------------------ Start / Dead overlays ------------------ */
function drawStart() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", canvas.width / 2, canvas.height / 2 - 18);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("PRESS ENTER / TAP TO BEGIN", canvas.width / 2, canvas.height / 2 + 16);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillText("MOVE: WASD/ARROWS  •  ATTACK: J/SPACE  •  DASH: K/SHIFT", canvas.width / 2, canvas.height / 2 + 44);

  ctx.restore();
}

/* tap to start/restart */
canvas.addEventListener("pointerdown", () => {
  if (state === STATE.START) startGame();
  else if (state === STATE.DEAD) startGame();
}, { passive: true });

/* ------------------ Loop ------------------ */
let last = performance.now();
function frame(now) {
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(config.dtCap, rawDt);

  update(dt);
  render();

  requestAnimationFrame(frame);
}

/* ------------------ Boot ------------------ */
state = STATE.START;
ui = new UIManager(); // allow start screen UI if you want it
requestAnimationFrame(frame);
