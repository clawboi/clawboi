import { Player } from "./player.js";
import { World } from "./world.js";
import { EnemyManager } from "./enemies.js";
import { Effects } from "./effects.js";
import { UI } from "./ui.js";

/* ------------------ Canvas setup (pixel sharp) ------------------ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const STATE = { START:"start", PLAY:"play", DEAD:"dead" };
let state = STATE.START;

const config = {
  baseW: 320,
  baseH: 180,
  scale: 4,
  minScale: 3,
  maxScale: 7,
  dtCap: 1/30,
};

function resize(){
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const sx = Math.floor(ww / config.baseW);
  const sy = Math.floor(wh / config.baseH);
  config.scale = Math.max(config.minScale, Math.min(config.maxScale, Math.min(sx, sy)));

  canvas.width  = config.baseW * config.scale;
  canvas.height = config.baseH * config.scale;

  canvas.style.width  = canvas.width + "px";
  canvas.style.height = canvas.height + "px";

  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);
resize();

/* ------------------ Input (solid + non-sticky) ------------------ */
const keys = new Set();
const pressed = new Set(); // edge-trigger: first frame only

function keyName(e){
  // normalize space + shift + arrows reliably
  if(e.key === " ") return " ";
  return e.key.toLowerCase();
}

window.addEventListener("keydown", (e)=>{
  const k = keyName(e);
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();

  if(!keys.has(k)) pressed.add(k);
  keys.add(k);

  // Start / restart
  if((state === STATE.START || state === STATE.DEAD) && (k === "enter" || k === " ")) startGame();
});

window.addEventListener("keyup", (e)=>{
  const k = keyName(e);
  keys.delete(k);
  pressed.delete(k);
});

// HUGE: prevents “stuck movement” when you alt-tab or iOS focus changes
window.addEventListener("blur", ()=>{
  keys.clear();
  pressed.clear();
});

const isDown = (k)=> keys.has(k);
const wasPressed = (k)=> pressed.has(k);

/* ------------------ Game objects ------------------ */
let world, player, enemies, effects, ui;

const camera = { x:0, y:0, shake:0, shakeT:0 };
const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
function camShake(power=3, time=0.12){
  camera.shake = Math.max(camera.shake, power);
  camera.shakeT = Math.max(camera.shakeT, time);
}

/* ------------------ Start/Restart ------------------ */
function startGame(){
  world = new World({ w: 256, h: 256, seed: (Math.random()*1e9)|0 });
  player = new Player({ x: world.spawnX, y: world.spawnY });
  enemies = new EnemyManager(world);
  effects = new Effects();
  ui = new UI();

  enemies.spawnWave(player.x, player.y, 1);
  ui.toast("ENTER THE FOREST NODE", 1.2, "good");

  state = STATE.PLAY;
}

/* ------------------ Update ------------------ */
function getMove(){
  let mx=0, my=0;
  if(isDown("a") || isDown("arrowleft")) mx -= 1;
  if(isDown("d") || isDown("arrowright")) mx += 1;
  if(isDown("w") || isDown("arrowup")) my -= 1;
  if(isDown("s") || isDown("arrowdown")) my += 1;

  const len = Math.hypot(mx,my);
  if(len>1e-6){ mx/=len; my/=len; }
  return {mx,my};
}

let spawnT = 0;

function update(dt){
  if(state === STATE.START) return;

  ui.update(dt);
  effects.update(dt);

  if(state === STATE.DEAD) return;

  const {mx,my} = getMove();
  player.setMove(mx,my);

  // IMPORTANT: edge-trigger attack/dash (feels way less “finicky”)
  const attackPressed = wasPressed("j") || wasPressed(" ");
  const dashPressed   = wasPressed("k") || wasPressed("shift");

  if(attackPressed) player.tryAttack();
  if(dashPressed) player.tryDash();

  player.update(dt, world, effects);

  enemies.update(dt, player, world, effects);

  const hit = enemies.resolvePlayerAttack(player);
  if(hit.count){
    camShake(2 + hit.count, 0.08);
    effects.hitFlash(0.12);
    if(hit.kills){
      player.addXP(hit.kills * 6);
      ui.floatText(player.x, player.y - 10, `+${hit.kills*6} XP`, "good");
    }
  }

  const took = enemies.resolveEnemyHits(player);
  if(took){
    camShake(6, 0.10);
    effects.damagePulse(0.18);
    ui.toast("HIT", 0.35, "danger");
  }

  spawnT -= dt;
  if(spawnT <= 0){
    enemies.spawnWave(player.x, player.y, player.level);
    spawnT = Math.max(1.8, 3.0 - player.level*0.12);
  }

  // camera follow
  const targetX = player.x - config.baseW/2;
  const targetY = player.y - config.baseH/2;
  camera.x += (targetX - camera.x) * (1 - Math.pow(0.001, dt));
  camera.y += (targetY - camera.y) * (1 - Math.pow(0.001, dt));

  camera.x = clamp(camera.x, 0, world.bounds.w - config.baseW);
  camera.y = clamp(camera.y, 0, world.bounds.h - config.baseH);

  if(camera.shakeT>0){
    camera.shakeT -= dt;
    camera.shake *= 0.86;
    if(camera.shakeT<=0) camera.shake = 0;
  }

  if(player.hp <= 0){
    state = STATE.DEAD;
    ui.banner("YOU DIED", "PRESS ENTER / TAP TO RESTART");
    ui.toast("THE FOREST ATE YOU", 1.4, "danger");
    camShake(10, 0.25);
  }

  // consume pressed keys (so “pressed” is 1-frame only)
  pressed.clear();
}

/* ------------------ Draw ------------------ */
function draw(){
  ctx.fillStyle = "#050508";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  if(state === STATE.START){
    drawStart();
    requestAnimationFrame(draw);
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(config.scale, config.scale);

  let sx=0, sy=0;
  if(camera.shake>0){
    sx = (Math.random()*2-1) * camera.shake * 0.7;
    sy = (Math.random()*2-1) * camera.shake * 0.7;
  }
  const camX = (camera.x + sx) | 0;
  const camY = (camera.y + sy) | 0;

  world.draw(ctx, camX, camY, effects);
  enemies.draw(ctx, camX, camY, effects);
  player.draw(ctx, camX, camY, effects);

  effects.drawOverlay(ctx, config.baseW, config.baseH);

  ctx.restore();

  ui.draw(ctx, canvas.width, canvas.height, player, effects);

  requestAnimationFrame(draw);
}

function drawStart(){
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(138,46,255,0.95)";
  ctx.font = "22px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("THE ADVENTURES OF CLAWBOI", canvas.width/2, canvas.height/2 - 18);

  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("PRESS ENTER / TAP TO BEGIN", canvas.width/2, canvas.height/2 + 18);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText("MOVE: WASD/ARROWS   ATTACK: J/SPACE   DASH: K/SHIFT", canvas.width/2, canvas.height/2 + 42);

  ctx.restore();
}

/* ------------------ Loop ------------------ */
let last = performance.now();
function loop(now){
  const rawDt = (now-last)/1000;
  last = now;
  const dt = Math.min(config.dtCap, rawDt);
  update(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
requestAnimationFrame(draw);

// tap to start / restart (keep this; it’s good)
canvas.addEventListener("pointerdown", ()=>{
  if(state === STATE.START) startGame();
  if(state === STATE.DEAD) startGame();
}, {passive:true});
