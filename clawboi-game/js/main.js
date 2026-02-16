// main.js — "never-black" version (world + fx + ui contexts)
// Works even if your SceneManager API is different.

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
  DOM helpers
----------------------------- */
function mustGet(id){
  const el = document.getElementById(id);
  if(!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

function safeCall(obj, name, ...args){
  const fn = obj && obj[name];
  if(typeof fn === "function") return fn(...args);
  return undefined;
}

/* -----------------------------
  Canvases
----------------------------- */
const worldCanvas = mustGet("world");
const fxCanvas    = mustGet("fx");
const uiCanvas    = mustGet("ui");

const atkBtn  = document.getElementById("atk");
const dashBtn = document.getElementById("dash");

/* -----------------------------
  Scale once at boot (your scaler.js should handle resize events)
----------------------------- */
scale(worldCanvas, fxCanvas, uiCanvas);

/* -----------------------------
  Renderers
----------------------------- */
const worldR = new Renderer(worldCanvas);
const fxR    = new Renderer(fxCanvas);
const uiR    = new Renderer(uiCanvas);

/* -----------------------------
  Core systems
----------------------------- */
const clock  = new Clock();
const scenes = new Scenes();
const cam    = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
const input  = new Input(atkBtn, dashBtn);
const prof   = new Profiler();

/* -----------------------------
  Hard reset that works with many scene managers
----------------------------- */
function hardClearScenes(){
  // common APIs
  safeCall(scenes, "clear");
  safeCall(scenes, "reset");
  safeCall(scenes, "popAll");

  // brute force if stack arrays exist
  if (Array.isArray(scenes.stack)) scenes.stack.length = 0;
  if (Array.isArray(scenes._stack)) scenes._stack.length = 0;

  // if none of those exist, try popping repeatedly
  if (typeof scenes.pop === "function" && typeof scenes.peek === "function") {
    let guard = 0;
    while (scenes.peek() && guard++ < 999) scenes.pop();
  }
}

function bootGame(){
  hardClearScenes();
  // push a fresh GameScene
  scenes.push(new GameScene(cam, input));
}

bootGame();

/* -----------------------------
  Safer clear (don’t trust renderer impl)
----------------------------- */
function clearCtx(ctx, color){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
}

function clearTransparent(ctx){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
}

/* -----------------------------
  "Never-black" sanity marker on WORLD layer
  If you see this square, your WORLD canvas is alive.
----------------------------- */
function drawWorldSanity(){
  const c = worldR.ctx;
  c.save();
  c.fillStyle = "#b388ff";
  c.fillRect(6, 6, 8, 8);
  c.restore();
}

/* -----------------------------
  Error overlay helper
----------------------------- */
let lastErr = "";
function drawErrorOverlay(msg){
  lastErr = String(msg || "Unknown error");
  const u = uiR.ctx;
  u.save();
  u.setTransform(1,0,0,1,0,0);
  u.fillStyle = "rgba(0,0,0,0.72)";
  u.fillRect(0,0,u.canvas.width,u.canvas.height);
  u.fillStyle = "#ff4a7a";
  u.font = "12px ui-monospace, Menlo, Consolas, monospace";
  u.textBaseline = "top";
  u.fillText("ERROR:", 10, 10);
  u.fillStyle = "rgba(255,255,255,0.85)";
  u.fillText(lastErr.slice(0, 160), 10, 28);
  u.fillStyle = "rgba(255,255,255,0.6)";
  u.fillText("Press R to restart scene.", 10, 48);
  u.restore();
}

/* -----------------------------
  Main loop
----------------------------- */
function frame(){
  const dt = clock.tick();
  prof.tick(dt);

  // UPDATE
  try{
    scenes.update(dt);
    input.end();
  }catch(e){
    drawErrorOverlay(e?.message || e);
    requestAnimationFrame(frame);
    return;
  }

  // DRAW
  try{
    clearCtx(worldR.ctx, CONFIG.BG || "#07070c");
    clearTransparent(fxR.ctx);
    clearTransparent(uiR.ctx);

    // IMPORTANT: pass all 3 ctxs.
    // If your scene ignores extra params, fine.
    // If your scene expects them, this fixes the “black world” bug.
    if (typeof scenes.draw === "function"){
      scenes.draw(worldR.ctx, fxR.ctx, uiR.ctx);
    }

    // Force a small visible marker on the world layer
    drawWorldSanity();

    // Minimal HUD so you always know it’s running
    const u = uiR.ctx;
    u.save();
    u.setTransform(1,0,0,1,0,0);
    u.fillStyle = "#b388ff";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";
    u.fillText(`FPS ${prof.fps}`, 10, 10);
    u.restore();

  }catch(e){
    drawErrorOverlay(e?.message || e);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

/* -----------------------------
  Restart keys
----------------------------- */
window.addEventListener("keydown", (e) => {
  const k = (e.key || "").toLowerCase();
  if (k === "r") bootGame();
});

/* -----------------------------
  Surface uncaught errors
----------------------------- */
window.addEventListener("error", (ev) => {
  drawErrorOverlay(ev?.message || ev?.error || "Uncaught error");
});
window.addEventListener("unhandledrejection", (ev) => {
  drawErrorOverlay(ev?.reason?.message || ev?.reason || "Unhandled promise rejection");
});

