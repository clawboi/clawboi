import {CONFIG} from "./config.js";
import {scale} from "./scaler.js";
import {Clock} from "./time.js";
import {Renderer} from "./renderer.js";
import {Scenes} from "./sceneManager.js";
import {Camera} from "./camera.js";
import {Input} from "./input.js";
import {Profiler} from "./profiler.js";

const worldCanvas=document.getElementById("world");
const fxCanvas=document.getElementById("fx");
const uiCanvas=document.getElementById("ui");

scale(worldCanvas,fxCanvas,uiCanvas);

const worldR=new Renderer(worldCanvas);
const fxR=new Renderer(fxCanvas);
const uiR=new Renderer(uiCanvas);

const clock=new Clock();
const scenes=new Scenes();
const cam=new Camera(CONFIG.WIDTH,CONFIG.HEIGHT);
const input=new Input(
document.getElementById("atk"),
document.getElementById("dash")
);
const prof=new Profiler();

function update(){

let dt=clock.tick();
prof.tick(dt);

scenes.update(dt);
input.end();
}

function draw(){

worldR.clear(CONFIG.BG);
fxR.clear("rgba(0,0,0,0)");
uiR.clear("rgba(0,0,0,0)");

scenes.draw(worldR.ctx);

uiR.ctx.fillStyle="#b388ff";
uiR.ctx.fillText("FPS "+prof.fps,6,12);
}

function loop(){
update();
draw();
requestAnimationFrame(loop);
}
loop();
