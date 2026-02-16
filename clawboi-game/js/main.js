import { CONFIG } from "./config.js";
import { scale } from "./scaler.js";
import { Clock } from "./time.js";
import { Renderer } from "./renderer.js";
import { Scenes } from "./sceneManager.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Profiler } from "./profiler.js";
import { GameScene } from "./gameScene.js";

function mustGetEl(id){
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

const worldCanvas = mustGetEl("world");
const fxCanvas = mustGetEl("fx");
const uiCanvas = mustGetEl("ui");

const atkBtn = document.getElementById("atk") || null;
const dashBtn = document.getElementById("dash") || null;

scale(worldCanvas, fxCanvas, uiCanvas);

const worldR = new Renderer(worldCanvas);
const fxR = new Renderer(fxCanvas);
const uiR = new Renderer(uiCanvas);

const clock = new Clock();
const scenes = new Scenes();
const cam = new Camera(CONFIG.WIDTH, CONFIG.HEIGHT);
const input = new Input(atkBtn, dashBtn);
const prof = new Profiler();

function boot(){
  scenes.clear();
  scenes.push(new GameScene(cam, input));
}
boot();

function frame(){
  const dt = clock.tick();
  prof.tick(dt);

  scenes.update(dt);
  input.end();

  // draw layers
  worldR.clear(CONFIG.BG);
  fxR.clear("rgba(0,0,0,0)");
  uiR.clear("rgba(0,0,0,0)");

  // world drawn on world canvas by scene
  scenes.draw(worldR.ctx);

  // UI
  const s = scenes.top();
  if (s && typeof s.drawUI === "function"){
    s.drawUI(uiR.ctx, prof.fps);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// restart
window.addEventListener("keydown", (e)=>{
  const k = (e.key||"").toLowerCase();
  if (k === "r") boot();
}, { passive:true });

// show hard errors on canvas (instead of “black nothing”)
window.addEventListener("error", (ev)=>{
  try{
    const u = uiR.ctx;
    u.setTransform(1,0,0,1,0,0);
    u.clearRect(0,0,uiCanvas.width,uiCanvas.height);
    u.fillStyle = "rgba(0,0,0,0.75)";
    u.fillRect(0,0,uiCanvas.width,uiCanvas.height);
    u.fillStyle = "#ff4a7a";
    u.font = "12px ui-monospace, Menlo, Consolas, monospace";
    u.textBaseline = "top";
    const msg = String(ev.message || ev.error || "Unknown error");
    u.fillText("CRASH:", 10, 10);
    u.fillText(msg.slice(0, 160), 10, 28);
    u.fillStyle = "rgba(255,255,255,0.75)";
    u.fillText("Open DevTools Console for file/line.", 10, 50);
  }catch(_){}
});
