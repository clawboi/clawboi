import {CONFIG} from "./config.js";

export function scale(...canvases){

function resize(){

let sx=Math.floor(innerWidth/CONFIG.WIDTH);
let sy=Math.floor(innerHeight/CONFIG.HEIGHT);
let s=Math.min(sx,sy)||1;
s=Math.max(CONFIG.MIN_SCALE,Math.min(CONFIG.MAX_SCALE,s));

for(let c of canvases){
c.width=CONFIG.WIDTH;
c.height=CONFIG.HEIGHT;
c.style.width=CONFIG.WIDTH*s+"px";
c.style.height=CONFIG.HEIGHT*s+"px";
}
}

addEventListener("resize",resize);
resize();
}
