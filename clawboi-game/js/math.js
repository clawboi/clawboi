import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";
import { GameScene } from "./gameScene.js";

function must(id){
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

const worldCanvas = must("world");
const fxCanvas = must("fx");
const uiCanvas = must("ui");

scale(worldCanvas, fxCanvas, uiCanvas);

const worldR = new Renderer(worldCanvas);
const fxR = new Renderer(fxCanvas);
const uiR = new Renderer(uiCanvas);

const clock = new Clock();
const scenes = new Scenes();
const cam = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
const input = new Input(document.getElementById("atk"), document.getElementById("dash"));
const prof = new Profiler();

function boot(){
  scenes.clear();
  scenes.push(new GameScene(cam, input));
}
boot();

// weapon swap keys (safe)
window.addEventListener("keydown",(e)=>{
  const s = scenes.top();
  if (!s || !s.weapons) return;
  if (e.key === "1") s.weapons.set("punch");
  if (e.key === "2") s.weapons.set("claw");
  if (e.key === "3") s.weapons.set("gun");
});

window.addEventListener("keydown",(e)=>{
  const k = (e.key||"").toLowerCase();
  if (k === "r") boot();
}, { passive:true });

function frame(){
  const dt = clock.tick();
  prof.tick(dt);

  const s = scenes.top();
  if (s && typeof s.update === "function") s.update(dt);

  // draw layers
  worldR.clear(CONFIG.BG);
  fxR.clear("rgba(0,0,0,0)");
  uiR.clear("rgba(0,0,0,0)");

  if (s && typeof s.draw === "function") s.draw(worldR.ctx);
  if (s && typeof s.drawFX === "function") s.drawFX(fxR.ctx);
  if (s && typeof s.drawUI === "function") s.drawUI(uiR.ctx);
  if (s && typeof s.drawOverlay === "function") s.drawOverlay(uiR.ctx);

  // tiny fps
  const u = uiR.ctx;
  u.save();
  u.fillStyle = "rgba(179,136,255,0.7)";
  u.font = "10px ui-monospace, Menlo, Consolas, monospace";
  u.textBaseline = "top";
  u.fillText(`FPS ${prof.fps}`, 6, CONFIG.HEIGHT - 14);
  u.restore();

  input.end();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// show errors ON SCREEN (so no more silent black)
window.addEventListener("error", (ev)=>{
  try{
    uiR.clear("rgba(0,0,0,0.8)");
    const u = uiR.ctx;
    u.fillStyle = "rgba(255,74,122,0.95)";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";
    u.fillText("CRASH:", 10, 10);
    u.fillText(String(ev.message || "Unknown error").slice(0, 160), 10, 30);
    u.fillStyle = "rgba(255,255,255,0.7)";
    u.fillText("Check DevTools Console for file + line.", 10, 56);
  }catch(_){}
});

