// main.js (crash-proof version)
// Assumes you are using <script type="module" src="js/main.js"></script>

import { GameScene } from "./gameScene.js";
import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";

/* -----------------------------
  hard safety helpers
----------------------------- */
function mustGetEl(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}. Check your HTML canvases/buttons.`);
  }
  return el;
}

function safeCall(obj, fnName, args = []) {
  const fn = obj && obj[fnName];
  if (typeof fn === "function") return fn.apply(obj, args);
  return undefined;
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
  scene boot (NO CRASH if clear() not implemented)
----------------------------- */
function resetScenesToGame() {
  // Try common APIs safely:
  safeCall(scenes, "clear");
  safeCall(scenes, "reset");
  safeCall(scenes, "popAll");

  // If none exist, do a brute-force drain if scenes.stack exists
  if (scenes && Array.isArray(scenes.stack)) {
    scenes.stack.length = 0;
  }
  if (scenes && Array.isArray(scenes._stack)) {
    scenes._stack.length = 0;
  }

  // Always push the playable scene
  scenes.push(new GameScene(cam, input));
}

// start immediately
resetScenesToGame();

/* -----------------------------
  main loop
----------------------------- */
function frame() {
  // UPDATE
  const dt = clock.tick();
  prof.tick(dt);

  scenes.update(dt);
  input.end();

  // DRAW (3-layer canvases)
  worldR.clear(CONFIG.BG);
  fxR.clear("rgba(0,0,0,0)");
  uiR.clear("rgba(0,0,0,0)");

  scenes.draw(worldR.ctx);

  // HUD (never crashes if font missing)
  const u = uiR.ctx;
  u.save();
  u.fillStyle = "#b388ff";
  u.font = "12px ui-monospace, Menlo, Consolas, monospace";
  u.textBaseline = "top";
  u.fillText(`FPS ${prof.fps}`, 6, 6);
  u.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

/* -----------------------------
  restart keys + click
----------------------------- */
window.addEventListener(
  "keydown",
  (e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "r") resetScenesToGame();
  },
  { passive: true }
);

window.addEventListener(
  "pointerdown",
  () => {
    // If you later add audio, mobile browsers often require a user gesture.
    // Leaving this here is harmless.
  },
  { passive: true }
);

/* -----------------------------
  extra: show errors on screen instead of silent black
----------------------------- */
window.addEventListener("error", (ev) => {
  try {
    const u = uiR.ctx;
    u.save();
    u.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    u.fillStyle = "rgba(0,0,0,0.75)";
    u.fillRect(0, 0, uiCanvas.width, uiCanvas.height);
    u.fillStyle = "#ff4a7a";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";
    const msg = String(ev.message || ev.error || "Unknown error");
    u.fillText("CRASH:", 10, 10);
    u.fillText(msg.slice(0, 120), 10, 28);
    u.fillStyle = "rgba(255,255,255,0.75)";
    u.fillText("Open DevTools Console for file/line.", 10, 50);
    u.restore();
  } catch (_) {}
});
