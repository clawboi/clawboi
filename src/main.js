import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha:false });

const debugEl = document.getElementById("debug");
let debugOn = false;

const mobileAtkBtn = document.getElementById("mAtk");
const mobileDashBtn = document.getElementById("mDash");

/* ---------- canvas scaling ---------- */
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

/* ---------- input + objects ---------- */
const input = new Input({ canvas, mobileAtkBtn, mobileDashBtn });
const player = new PlayerTest();

const STATE = { START:"start", PLAY:"play" };
let state = STATE.START;

function startGame(){
  state = STATE.PLAY;
}

canvas.addEventListener("pointerdown", ()=>{
  if(state === STATE.START) startGame();
}, { passive:true });

/* ---------- loop ---------- */
let last = now();
let fpsS = 0;

function loop(t){
  const rawDt = (t - last)/1000;
  last = t;
  const dt = Math.min(CONFIG.dtCap, rawDt);

  const fps = dt>0 ? 1/dt : 0;
  fpsS = lerp(fpsS || fps, fps, 0.08);

  update(dt);
  draw(fpsS);

  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  if(state === STATE.START){
    if(input.startPressed()) startGame();
    return;
  }

  // dash
  if(input.dash()) player.tryDash();

  player.update(dt, input);

  // we’ll wire attack in Part 4 (combat overhaul)
}

function draw(fps){
  // clear
  ctx.fillStyle = CONFIG.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw in base space
  ctx.save();
  ctx.scale(view.scale, view.scale);

  // test room floor
  ctx.fillStyle = "#071012";
  ctx.fillRect(0,0,CONFIG.baseW, CONFIG.baseH);

  // pixel grass pattern
  for(let y=0;y<CONFIG.baseH;y++){
    for(let x=0;x<CONFIG.baseW;x++){
      if(((x*19 + y*11) & 31) === 0){
        ctx.fillStyle = ((x+y)&1) ? "#0b1b14" : "#0c2017";
        ctx.fillRect(x,y,1,1);
      }
      if(((x*17 + y*13) & 127) === 0){
        ctx.fillStyle = "rgba(138,46,255,0.45)";
        ctx.fillRect(x,y,1,1);
      }
    }
  }

  // boundary
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0,0,CONFIG.baseW,6);
  ctx.fillRect(0,CONFIG.baseH-6,CONFIG.baseW,6);
  ctx.fillRect(0,0,6,CONFIG.baseH);
  ctx.fillRect(CONFIG.baseW-6,0,6,CONFIG.baseH);

  // title overlay if start
  if(state === STATE.START){
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,CONFIG.baseW,CONFIG.baseH);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.font = "18px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("THE ADVENTURES OF CLAWBOI", CONFIG.baseW/2, 74);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText("PART 2: INPUT ONLINE", CONFIG.baseW/2, 94);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(isTouchDevice() ? "TAP TO START" : "PRESS ENTER TO START", CONFIG.baseW/2, 124);

    ctx.restore();
    if(debugOn){
      debugEl.textContent =
        `STATE ${state}\n`+
        `SCALE ${view.scale}x\n`+
        `FPS ${fmt(fps,0)}\n`;
    }
    return;
  }

  // draw player
  player.draw(ctx);

  // joystick visual on touch (so you know it’s reading)
  if(isTouchDevice() && input.stick.active){
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(40, CONFIG.baseH-40, 18, 0, Math.PI*2);
    ctx.stroke();

    ctx.fillStyle = "rgba(138,46,255,0.55)";
    ctx.fillRect(
      (40 + input.stick.dx*14 - 2)|0,
      (CONFIG.baseH-40 + input.stick.dy*14 - 2)|0,
      4,4
    );
  }

  ctx.restore();

  // debug overlay
  if(debugOn){
    debugEl.textContent =
      `STATE ${state}\n`+
      `SCALE ${view.scale}x\n`+
      `FPS ${fmt(fps,0)}\n`+
      `MOVE ${fmt(input.moveVector().mx,2)}, ${fmt(input.moveVector().my,2)}\n`+
      `DASH ${input.dash() ? "ON" : "OFF"}\n`+
      `ATK ${input.attack() ? "ON" : "OFF"}\n`;
  }
}

