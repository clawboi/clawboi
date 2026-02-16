import { CONFIG } from "./config.js";
import { clamp, lerp, now, fmt, isTouchDevice } from "./utils.js";
import { Input } from "./input.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { WorldNode } from "./world_node.js";
import { Camera } from "./camera.js";
import { PickupManager } from "./pickups.js";
import { EnemyManager } from "./enemies.js";
import { DropManager } from "./drops.js";
import { FX } from "./fx.js";
import { Quest } from "./quest.js";
import { Interactables } from "./interactables.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const debugEl = document.getElementById("debug");
let debugOn = false;

let cam = null;

const mobileAtkBtn = document.getElementById("mAtk");
const mobileDashBtn = document.getElementById("mDash");

const view = { scale: CONFIG.minScale, pxW: 0, pxH: 0 };

function calcScale(){
  const vv = window.visualViewport;
  const ww = vv ? vv.width : window.innerWidth;
  const wh = vv ? vv.height : window.innerHeight;
  const sx = Math.floor(ww / CONFIG.baseW);
  const sy = Math.floor(wh / CONFIG.baseH);
  const s = Math.min(sx, sy) || CONFIG.minScale;
  return clamp(s, CONFIG.minScale, CONFIG.maxScale);
}

function resize(){
  view.scale = calcScale();
  view.pxW = CONFIG.baseW * view.scale;
  view.pxH = CONFIG.baseH * view.scale;

  canvas.width = CONFIG.baseW;
  canvas.height = CONFIG.baseH;

  canvas.style.width = view.pxW + "px";
  canvas.style.height = view.pxH + "px";

  ctx.imageSmoothingEnabled = false;

  if (cam && cam.resizeView) cam.resizeView(CONFIG.baseW, CONFIG.baseH);
}
window.addEventListener("resize", resize, { passive:true });
resize();

/* debug toggle */
window.addEventListener("keydown",(e)=>{
  if(e.key==="`"){
    debugOn=!debugOn;
    debugEl.style.display=debugOn?"block":"none";
  }
},{passive:true});

/* input */
const input=new Input({canvas,mobileAtkBtn,mobileDashBtn});

/* interact key */
let interactPressed=false;
window.addEventListener("keydown",(e)=>{
  if((e.key||"").toLowerCase()==="e") interactPressed=true;
},{passive:true});

/* state */
const STATE={START:"start",PLAY:"play",WIN:"win",DEAD:"dead"};
let state=STATE.START;

let world=null;
let forest=null;
let node=null;
let player=null;
let pickups=null;
let enemies=null;
let drops=null;
let fx=null;
let quest=null;
let interact=null;
let room="forest";

/* minimap */
let mapCanvas=null;
let mapCtx=null;
let mapDirty=true;

function ensureMapCanvas(){
  if(mapCanvas) return;
  mapCanvas=document.createElement("canvas");
  mapCtx=mapCanvas.getContext("2d");
}

function rebuildMinimap(){
  ensureMapCanvas();
  mapDirty=false;

  const tilesW=world && world.tilesW ? world.tilesW : (world.w||0);
  const tilesH=world && world.tilesH ? world.tilesH : (world.h||0);
  const tiles=world && world.tiles ? world.tiles : null;

  const MW=96, MH=72;
  mapCanvas.width=MW;
  mapCanvas.height=MH;

  mapCtx.clearRect(0,0,MW,MH);
  mapCtx.fillStyle="rgba(0,0,0,0.35)";
  mapCtx.fillRect(0,0,MW,MH);

  if(tiles && tilesW>0 && tilesH>0){
    const sx=MW/tilesW;
    const sy=MH/tilesH;
    for(let y=0;y<tilesH;y++){
      for(let x=0;x<tilesW;x++){
        const t=tiles[x+y*tilesW];
        mapCtx.fillStyle=t?"rgba(10,10,16,0.85)":"rgba(11,27,20,0.72)";
        mapCtx.fillRect(x*sx,y*sy,sx+.5,sy+.5);
      }
    }
  }
}

/* hitstop */
let hitStop=0;
function doHitStop(t=0.05){ hitStop=Math.max(hitStop,t); }

/* fallback hitbox */
let atkHB=null;
let atkHBt=0;
function getAttackHB(){
  let hb=null;
  if(player && typeof player.getAttackHitbox==="function"){
    hb=player.getAttackHitbox();
  }
  if(hb) return hb;
  if(atkHBt>0 && atkHB) return atkHB;
  return null;
}

/* inventory */
const inv={key:false};

/* start */
function startGame(){
  forest=new WorldForest({tilesW:160,tilesH:120,tileSize:8,seed:(Math.random()*1e9)|0});
  node=new WorldNode();

  world=forest;
  room="forest";

  player=new PlayerTest(world.spawn.x,world.spawn.y);

  cam=new Camera({
    viewW:CONFIG.baseW,
    viewH:CONFIG.baseH,
    worldW:world.worldW,
    worldH:world.worldH
  });

  resize();

  pickups=new PickupManager(); pickups.reset(3);
  enemies=new EnemyManager(world); enemies.reset();
  drops=new DropManager(); drops.reset();
  fx=new FX(); fx.reset();
  quest=new Quest(); quest.reset();
  interact=new Interactables(); interact.reset();

  inv.key=false;

  enemies.spawnWaveAround(player.x,player.y,player.level);

  state=STATE.PLAY;
}

/* loop */
let last=now();
let fpsS=0;
let waveTimer=0;
let tWorld=0;

function loop(t){
  const rawDt=(t-last)/1000;
  last=t;
  const dt=Math.min(CONFIG.dtCap,rawDt);
  const fps=dt>0?1/dt:0;
  fpsS=lerp(fpsS||fps,fps,.08);
  update(dt);
  draw(fpsS);
  input.endFrame();
  interactPressed=false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  if(state!==STATE.PLAY) return;

  atkHBt=Math.max(0,atkHBt-dt);

  if(hitStop>0){
    hitStop=Math.max(0,hitStop-dt);
    fx.update(dt*.35);
    return;
  }

  tWorld+=dt;
  fx.update(dt);

  if(input.attack()){
    if(player.tryAttack()){
      const dirx=player && player.face ? player.face.x:1;
      const diry=player && player.face ? player.face.y:0;

      atkHB={
        x:player.x+dirx*14,
        y:player.y+diry*14,
        r:14,
        dmg:14+(player.level*2),
        kb:220
      };
      atkHBt=.09;
    }
  }

  player.update(dt,input,world);
  enemies.update(dt,player,world);

  const hb=getAttackHB();
  if(hb){
    if(enemies.resolvePlayerAttack){
      enemies.resolvePlayerAttack(player,hb);
    }
  }

  waveTimer-=dt;
  if(waveTimer<=0){
    if(enemies.aliveCount && enemies.aliveCount()===0){
      enemies.spawnWaveAround(player.x,player.y,player.level);
      waveTimer=10;
    }else waveTimer=.5;
  }

  cam.worldW=world.worldW;
  cam.worldH=world.worldH;
  cam.update(dt,player.x,player.y);
}

function draw(fps){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle=CONFIG.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  if(state===STATE.START){
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.fillText("CLICK TO START",CONFIG.baseW/2,CONFIG.baseH/2);
    return;
  }

  const {sx,sy}=cam.getShakeOffset();
  const camX=(cam.x+sx)|0;
  const camY=(cam.y+sy)|0;

  world.draw(ctx,camX,camY,tWorld);
  enemies.draw(ctx,camX,camY);
  player.draw(ctx,camX,camY);
}
