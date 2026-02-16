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

/* ================= CANVAS ================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d",{alpha:false});

let cam = null;
let debugOn=false;

const debugEl=document.getElementById("debug");
const atkBtn=document.getElementById("mAtk");
const dashBtn=document.getElementById("mDash");

const view={scale:1,pxW:0,pxH:0};

function calcScale(){
 const ww=window.innerWidth;
 const wh=window.innerHeight;
 const sx=Math.floor(ww/CONFIG.baseW);
 const sy=Math.floor(wh/CONFIG.baseH);
 const s=Math.min(sx,sy)||1;
 return clamp(s,CONFIG.minScale,CONFIG.maxScale);
}

function resize(){
 view.scale=calcScale();
 view.pxW=CONFIG.baseW*view.scale;
 view.pxH=CONFIG.baseH*view.scale;

 canvas.width=CONFIG.baseW;
 canvas.height=CONFIG.baseH;

 canvas.style.width=view.pxW+"px";
 canvas.style.height=view.pxH+"px";

 ctx.imageSmoothingEnabled=false;

 if(cam&&cam.resizeView)cam.resizeView(CONFIG.baseW,CONFIG.baseH);
}
window.addEventListener("resize",resize);
resize();

/* ================= INPUT ================= */

const input=new Input({canvas:canvas,mobileAtkBtn:atkBtn,mobileDashBtn:dashBtn});

let interactPressed=false;
window.addEventListener("keydown",e=>{
 if((e.key||"").toLowerCase()==="e")interactPressed=true;
});

/* ================= STATE ================= */

const STATE={START:0,PLAY:1,WIN:2,DEAD:3};
let state=STATE.START;

let world=null;
let forest=null;
let node=null;

let player=null;
let enemies=null;
let drops=null;
let pickups=null;
let fx=null;
let quest=null;
let interact=null;

let room="forest";
const inv={key:false};

/* ================= MINIMAP ================= */

let mapCanvas=null;
let mapCtx=null;
let mapDirty=true;

function ensureMap(){
 if(mapCanvas)return;
 mapCanvas=document.createElement("canvas");
 mapCtx=mapCanvas.getContext("2d");
}

function rebuildMap(){
 ensureMap();
 mapDirty=false;

 const MW=96;
 const MH=72;
 mapCanvas.width=MW;
 mapCanvas.height=MH;

 mapCtx.fillStyle="black";
 mapCtx.fillRect(0,0,MW,MH);

 if(!world)return;

 const w=world.tilesW||world.w||0;
 const h=world.tilesH||world.h||0;
 const tiles=world.tiles||world.tile||null;

 if(!tiles||!w||!h)return;

 const sx=MW/w;
 const sy=MH/h;

 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const t=tiles[x+y*w];
   mapCtx.fillStyle=t?"#0a0a12":"#0d2d20";
   mapCtx.fillRect(x*sx,y*sy,sx+1,sy+1);
  }
 }
}

/* ================= HITSTOP ================= */

let hitStop=0;
function doHitStop(t){if(t>hitStop)hitStop=t}

/* ================= ATTACK HITBOX SAFE ================= */

let atkHB=null;
let atkHBt=0;

function getHB(){
 if(player&&player.getAttackHitbox){
  const h=player.getAttackHitbox();
  if(h)return h;
 }
 if(atkHBt>0)return atkHB;
 return null;
}

/* ================= START GAME ================= */

function startGame(){

 forest=new WorldForest({tilesW:160,tilesH:120,tileSize:8,seed:Math.random()*999999|0});
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

 enemies=new EnemyManager(world);
 enemies.reset();

 drops=new DropManager();
 drops.reset();

 pickups=new PickupManager();
 pickups.reset(3);

 fx=new FX();
 fx.reset();

 quest=new Quest();
 quest.reset();

 interact=new Interactables();
 interact.reset();

 inv.key=false;

 enemies.spawnWaveAround(player.x,player.y,player.level);

 mapDirty=true;
 rebuildMap();

 state=STATE.PLAY;
}

/* ================= LOOP ================= */

let last=now();
let waveTimer=0;
let tWorld=0;
let fpsSmooth=0;

function loop(t){

 const dt=Math.min(CONFIG.dtCap,(t-last)/1000);
 last=t;

 const fps=dt?1/dt:0;
 fpsSmooth=lerp(fpsSmooth||fps,fps,0.1);

 update(dt);
 draw(fpsSmooth);

 input.endFrame();
 interactPressed=false;

 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ================= UPDATE ================= */

function update(dt){

 if(state!==STATE.PLAY)return;

 atkHBt=Math.max(0,atkHBt-dt);

 if(hitStop>0){
  hitStop-=dt;
  fx.update(dt*0.4);
  return;
 }

 tWorld+=dt;
 fx.update(dt);

 if(room==="forest"&&world.setPortalActive){
  world.setPortalActive(pickups.done());
 }

 if(input.dash()){
  if(player.tryDash()){
   cam.kick(4,0.1);
   fx.pulseGood(0.1);
  }
 }

 if(input.attack()){
  if(player.tryAttack()){
   const dx=player.face?player.face.x:1;
   const dy=player.face?player.face.y:0;

   atkHB={
    x:player.x+dx*14,
    y:player.y+dy*14,
    r:14,
    dmg:14+player.level*2,
    kb:220
   };
   atkHBt=0.09;
  }
 }

 player.update(dt,input,world);
 enemies.update(dt,player,world);

 const hb=getHB();
 if(hb&&enemies.resolvePlayerHit){
  const h=enemies.resolvePlayerHit(hb)||{};
  const hits=h.hits||0;
  const kills=h.kills||0;

  if(hits){
   cam.kick(2+hits*0.6,0.08);
   doHitStop(0.03);
  }

  if(kills){
   player.addXP(kills*6);
  }
 }

 drops.update(dt,world);
 const got=drops.tryCollect(player);
 if(got){
  player.heal(got*2);
  player.addXP(got);
 }

 pickups.update(dt);
 if(pickups.tryCollect(player))mapDirty=true;

 waveTimer-=dt;
 if(waveTimer<=0){
  if(enemies.aliveCount()===0){
   enemies.spawnWaveAround(player.x,player.y,player.level);
   waveTimer=10;
  }else{
   waveTimer=0.5;
  }
 }

 cam.worldW=world.worldW;
 cam.worldH=world.worldH;
 cam.update(dt,player.x,player.y);

 if(player.hp<=0)state=STATE.DEAD;
}

/* ================= DRAW ================= */

function draw(fps){

 ctx.fillStyle=CONFIG.bg;
 ctx.fillRect(0,0,canvas.width,canvas.height);

 if(state===STATE.START){
  ctx.fillStyle="white";
  ctx.textAlign="center";
  ctx.fillText("CLICK TO START",CONFIG.baseW/2,100);
  return;
 }

 const shake=cam.getShakeOffset();
 const camX=(cam.x+shake.sx)|0;
 const camY=(cam.y+shake.sy)|0;

 world.draw(ctx,camX,camY,tWorld);
 drops.draw(ctx,camX,camY);
 enemies.draw(ctx,camX,camY);
 player.draw(ctx,camX,camY);

 drawHUD();

 if(debugOn){
  debugEl.textContent=
  "FPS "+fmt(fps,0)+"\n"+
  "Enemies "+enemies.aliveCount();
 }
}

/* ================= HUD ================= */

function drawHUD(){

 ctx.fillStyle="rgba(0,0,0,0.5)";
 ctx.fillRect(8,8,180,60);

 const hp=player.hp/player.hpMax;
 ctx.fillStyle="red";
 ctx.fillRect(14,16,160*hp,10);

 ctx.fillStyle="white";
 ctx.fillText("LV "+player.level,14,40);

 if(mapDirty)rebuildMap();
 ctx.drawImage(mapCanvas,CONFIG.baseW-120,10);
}

/* ================= START INPUT ================= */

canvas.addEventListener("pointerdown",()=>{
 if(state!==STATE.PLAY)startGame();
});
