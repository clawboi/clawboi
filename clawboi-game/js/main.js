// js/main.js (ultra crash-proof replacement)
// Assumes HTML uses: <script type="module" src="js/main.js"></script>

// -----------------------------
// SAFE IMPORTS (hard required)
// -----------------------------
import { GameScene } from "./gameScene.js";
import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";

// -----------------------------
// OPTIONAL IMPORT: weapons.js
// If missing OR has syntax error OR wrong export, the game still runs.
// -----------------------------
let WeaponSystem = null;
(async () => {
  try {
    const mod = await import("./weapons.js");
    if (mod && typeof mod.WeaponSystem === "function") {
      WeaponSystem = mod.WeaponSystem;
      // console.log("WeaponSystem loaded");
    }
  } catch (e) {
    // weapons disabled. No crash.
    // console.warn("WeaponSystem disabled:", e);
  }
})();

/* -----------------------------
  hard safety helpers
----------------------------- */
function mustGetEl(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(
      `Missing element #${id}. You need <canvas id="${id}"></canvas> in your HTML.`
    );
  }
  return el;
}

function safeCall(obj, fnName, args = []) {
  try {
    const fn = obj && obj[fnName];
    if (typeof fn === "function") return fn.apply(obj, args);
  } catch (_) {}
  return undefined;
}

function clamp01(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* -----------------------------
  DOM
----------------------------- */
const worldCanvas = mustGetEl("world");
const fxCanvas = mustGetEl("fx");
const uiCanvas = mustGetEl("ui");

const atkBtn = document.getElementById("atk") || null;
const dashBtn = document.getElementById("dash") || null;

/* -----------------------------
  scale canvases once at boot
----------------------------- */
scale(worldCanvas, fxCanvas, uiCanvas);

/* -----------------------------
  renderers / core systems
----------------------------- */
const worldR = new Renderer(worldCanvas);
const fxR = new Renderer(fxCanvas);
const uiR = new Renderer(uiCanvas);

const clock = new Clock();
const scenes = new Scenes();
const cam = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
const input = new Input(atkBtn, dashBtn);
const prof = new Profiler();

/* -----------------------------
  optional weapons instance (won't crash)
----------------------------- */
let weapons = null;
function initWeaponsSafe() {
  try {
    if (WeaponSystem) {
      weapons = new WeaponSystem({ enabled: true, defaultId: "claw" });
    } else {
      weapons = null;
    }
  } catch (_) {
    weapons = null;
  }
}

/* -----------------------------
  SCENE BOOT (safe even if sceneManager lacks methods)
----------------------------- */
function hardClearScenes() {
  // Try common APIs safely:
  safeCall(scenes, "clear");
  safeCall(scenes, "reset");
  safeCall(scenes, "popAll");

  // brute force drain common stacks
  if (scenes && Array.isArray(scenes.stack)) scenes.stack.length = 0;
  if (scenes && Array.isArray(scenes._stack)) scenes._stack.length = 0;
  if (scenes && Array.isArray(scenes.scenes)) scenes.scenes.length = 0;

  // If Scenes is implemented as { list: [...] }
  if (scenes && Array.isArray(scenes.list)) scenes.list.length = 0;
}

function bootGameScene() {
  hardClearScenes();

  // weapons are optional; initialize every boot
  initWeaponsSafe();

  // Create scene safely
  let scene = null;
  try {
    scene = new GameScene(cam, input, weapons); // if GameScene ignores 3rd arg, fine
  } catch (e) {
    // If GameScene signature is (cam,input) only
    scene = new GameScene(cam, input);
  }

  // Push scene safely
  try {
    scenes.push(scene);
  } catch (e) {
    // If Scenes has a different API, fallback to known stacks
    if (scenes && Array.isArray(scenes.stack)) scenes.stack.push(scene);
    else if (scenes && Array.isArray(scenes._stack)) scenes._stack.push(scene);
    else throw e; // last resort
  }
}

// start immediately
bootGameScene();

/* -----------------------------
  DRAW SAFE HUD + ERROR OVERLAY
----------------------------- */
let lastErrorMsg = "";
let lastErrorAt = 0;

function drawOverlayError(msg) {
  try {
    const u = uiR.ctx;
    u.save();
    u.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    u.fillStyle = "rgba(0,0,0,0.78)";
    u.fillRect(0, 0, uiCanvas.width, uiCanvas.height);

    u.fillStyle = "#ff4a7a";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";

    u.fillText("CRASH:", 10, 10);

    const lines = String(msg || "Unknown error").split("\n");
    let y = 28;
    for (let i = 0; i < lines.length && i < 6; i++) {
      u.fillText(lines[i].slice(0, 140), 10, y);
      y += 16;
    }

    u.fillStyle = "rgba(255,255,255,0.75)";
    u.fillText("Open DevTools Console for file/line.", 10, y + 8);
    u.fillText("Press R to restart scene.", 10, y + 26);

    u.restore();
  } catch (_) {}
}

function drawHUD() {
  const u = uiR.ctx;
  u.save();
  u.fillStyle = "#b388ff";
  u.font = "12px ui-monospace, Menlo, Consolas, monospace";
  u.textBaseline = "top";
  u.fillText(`FPS ${prof.fps}`, 6, 6);

  if (weapons && typeof weapons.getHudText === "function") {
    u.fillStyle = "rgba(255,255,255,0.75)";
    u.fillText(weapons.getHudText(), 6, 22);
  }

  u.restore();
}

/* -----------------------------
  MAIN LOOP
----------------------------- */
function frame() {
  // if we recently crashed, keep showing the overlay for a moment
  const now = performance.now();
  const showCrash = lastErrorMsg && now - lastErrorAt < 120000; // 2 minutes

  try {
    // UPDATE
    const dt = clock.tick();
    prof.tick(dt);

    // If weapons exists, tick it (safe)
    if (weapons && typeof weapons.update === "function") {
      try {
        weapons.update(dt);
      } catch (_) {}
    }

    // Update scenes (safe)
    safeCall(scenes, "update", [dt]);

    // If update() doesn't exist but there is a stack
    if (!scenes.update) {
      const top =
        (scenes.stack && scenes.stack[scenes.stack.length - 1]) ||
        (scenes._stack && scenes._stack[scenes._stack.length - 1]) ||
        null;
      if (top && typeof top.update === "function") top.update(dt);
    }

    input.end();

    // DRAW (3-layer canvases)
    worldR.clear(CONFIG.BG);
    fxR.clear("rgba(0,0,0,0)");
    uiR.clear("rgba(0,0,0,0)");

    // Draw scenes (safe)
    safeCall(scenes, "draw", [worldR.ctx]);

    // If draw() doesn't exist but there is a stack
    if (!scenes.draw) {
      const top =
        (scenes.stack && scenes.stack[scenes.stack.length - 1]) ||
        (scenes._stack && scenes._stack[scenes._stack.length - 1]) ||
        null;
      if (top && typeof top.draw === "function") top.draw(worldR.ctx);
    }

    // HUD
    drawHUD();

    // If crash overlay should show, show it ON TOP (but don't break the game)
    if (showCrash) {
      drawOverlayError(lastErrorMsg);
    }

    requestAnimationFrame(frame);
  } catch (e) {
    // record and render the error, but keep the RAF alive
    lastErrorMsg = String(e && (e.stack || e.message) ? e.stack || e.message : e);
    lastErrorAt = performance.now();
    drawOverlayError(lastErrorMsg);
    requestAnimationFrame(frame);
  }
}

requestAnimationFrame(frame);

/* -----------------------------
  RESTART KEY
----------------------------- */
window.addEventListener(
  "keydown",
  (e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "r") {
      lastErrorMsg = "";
      lastErrorAt = 0;
      bootGameScene();
    }
  },
  { passive: true }
);

/* -----------------------------
  USER GESTURE HOOK (harmless)
----------------------------- */
window.addEventListener(
  "pointerdown",
  () => {
    // Useful later if you add audio unlocks on mobile.
  },
  { passive: true }
);

/* -----------------------------
  GLOBAL ERRORS -> overlay instead of black screen
----------------------------- */
window.addEventListener("error", (ev) => {
  lastErrorMsg = String(ev && (ev.message || ev.error) ? ev.message || ev.error : ev);
  lastErrorAt = performance.now();
  drawOverlayError(lastErrorMsg);
});

window.addEventListener("unhandledrejection", (ev) => {
  lastErrorMsg = String(
    ev && ev.reason ? (ev.reason.stack || ev.reason.message || ev.reason) : "Unhandled rejection"
  );
  lastErrorAt = performance.now();
  drawOverlayError(lastErrorMsg);
});
