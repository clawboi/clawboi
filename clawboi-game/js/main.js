// js/main.js (fixed: pushes GameScene + shows errors on screen)

import { GameScene } from "./gameScene.js";
import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";

/* -------------------------
  tiny helpers
------------------------- */
function $(id) {
  return document.getElementById(id);
}

function must(id) {
  const el = $(id);
  if (!el) throw new Error(`Missing element #${id} in index.html`);
  return el;
}

function drawCrash(uiCtx, msg) {
  uiCtx.save();
  uiCtx.setTransform(1, 0, 0, 1, 0, 0);
  uiCtx.clearRect(0, 0, uiCtx.canvas.width, uiCtx.canvas.height);
  uiCtx.fillStyle = "rgba(0,0,0,0.85)";
  uiCtx.fillRect(0, 0, uiCtx.canvas.width, uiCtx.canvas.height);
  uiCtx.fillStyle = "#ff4a7a";
  uiCtx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  uiCtx.textBaseline = "top";
  uiCtx.fillText("CRASH / IMPORT ERROR", 10, 10);
  uiCtx.fillStyle = "rgba(255,255,255,0.85)";
  const lines = String(msg).split("\n");
  let y = 32;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    uiCtx.fillText(lines[i].slice(0, 140), 10, y);
    y += 14;
  }
  uiCtx.fillStyle = "rgba(255,255,255,0.6)";
  uiCtx.fillText("Fix the missing file/path shown above.", 10, y + 8);
  uiCtx.restore();
}

/* -------------------------
  BOOT
------------------------- */
let worldR, fxR, uiR;
let clock, scenes, cam, input, prof;

function boot() {
  const worldCanvas = must("world");
  const fxCanvas = must("fx");
  const uiCanvas = must("ui");

  // scale canvases
  scale(worldCanvas, fxCanvas, uiCanvas);

  // renderers
  worldR = new Renderer(worldCanvas);
  fxR = new Renderer(fxCanvas);
  uiR = new Renderer(uiCanvas);

  // core systems
  clock = new Clock();
  scenes = new Scenes();
  cam = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
  input = new Input($("atk"), $("dash"));
  prof = new Profiler();

  // ✅ THIS WAS MISSING IN YOUR MAIN:
  // push the actual game scene so update/draw does something
  scenes.push(new GameScene(cam, input));

  requestAnimationFrame(loop);
}

/* -------------------------
  LOOP
------------------------- */
function loop() {
  try {
    const dt = clock.tick();
    prof.tick(dt);

    // update
    scenes.update(dt);
    input.end();

    // draw
    worldR.clear(CONFIG.BG);
    fxR.clear("rgba(0,0,0,0)");
    uiR.clear("rgba(0,0,0,0)");

    scenes.draw(worldR.ctx);

    // simple HUD
    const u = uiR.ctx;
    u.save();
    u.fillStyle = "#b388ff";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";
    u.fillText("FPS " + prof.fps, 6, 6);
    u.restore();

    requestAnimationFrame(loop);
  } catch (err) {
    // show error on screen (instead of silent black)
    if (uiR && uiR.ctx) drawCrash(uiR.ctx, err?.stack || err);
    // stop the loop
  }
}

boot();

