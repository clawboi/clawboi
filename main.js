// ===============================
// CLAWBOI ENGINE SAFE MAIN
// Guaranteed visible render build
// ===============================

// ---------- IMPORTS ----------
import { GameScene } from "./gameScene.js";
import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";

// ---------- SAFE ELEMENT GET ----------
function el(id){
  const e = document.getElementById(id);
  if(!e) throw new Error("Missing element: "+id);
  return e;
}

// ---------- CANVASES ----------
const worldCanvas = el("world");
const fxCanvas = el("fx");
const uiCanvas = el("ui");

// always size them correctly
scale(worldCanvas, fxCanvas, uiCanvas);

// ---------- RENDERERS ----------
const worldR = new Renderer(worldCanvas);
const fxR = new Renderer(fxCanvas);
const uiR = new Renderer(uiCanvas);

// ---------- CORE SYSTEMS ----------
const clock = new Clock();
const scenes = new Scenes();
const cam = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
const input = new Input(
  document.getElementById("atk"),
  document.getElementById("dash")
);
const prof = new Profiler();

// ---------- SAFE SCENE LOADER ----------
function loadGame(){
  // wipe any existing scenes safely
  if(scenes.stack) scenes.stack.length = 0;
  if(scenes._stack) scenes._stack.length = 0;

  // push main scene
  scenes.push(new GameScene(cam,input));
}

// load immediately
loadGame();

// ---------- LOOP ----------
function frame(){

  // ---- UPDATE ----
  const dt = clock.tick();
  prof.tick(dt);

  try{
    scenes.update(dt);
  }catch(e){
    console.error("UPDATE ERROR:",e);
  }

  input.end();

  // ---- DRAW ----
  worldR.clear(CONFIG.BG || "#000");
  fxR.clear("rgba(0,0,0,0)");
  uiR.clear("rgba(0,0,0,0)");

  try{
    scenes.draw(worldR.ctx);
  }catch(e){
    console.error("DRAW ERROR:",e);
  }

  // ---------- ALWAYS VISIBLE DEBUG ----------
  const u = uiR.ctx;
  u.save();
  u.fillStyle="#8a2eff";
  u.font="14px monospace";
  u.textBaseline="top";
  u.fillText("ENGINE RUNNING",10,10);
  u.fillStyle="#fff";
  u.fillText("FPS "+prof.fps,10,30);
  u.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ---------- RESTART ----------
window.addEventListener("keydown", e=>{
  if(e.key.toLowerCase()==="r"){
    loadGame();
  }
});

// ---------- CRASH OVERLAY ----------
window.addEventListener("error", e=>{
  const u = uiR.ctx;
  u.save();
  u.fillStyle="rgba(0,0,0,.85)";
  u.fillRect(0,0,uiCanvas.width,uiCanvas.height);

  u.fillStyle="#ff4a7a";
  u.font="14px monospace";
  u.fillText("CRASH:",20,20);
  u.fillStyle="#fff";
  u.fillText(String(e.message).slice(0,120),20,50);

  u.restore();
});
