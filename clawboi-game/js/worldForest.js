import {World} from "./worldBase.js";

export class WorldForest extends World{

constructor(){
super(2400,1800);
this.spawn={x:1200,y:900};
}

draw(ctx,cam){

ctx.fillStyle="#0b0f18";
ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

ctx.fillStyle="#101827";
for(let i=0;i<400;i++){
let x=(i*73)%this.worldW;
let y=(i*137)%this.worldH;
ctx.fillRect(x-cam.x,y-cam.y,2,2);
}

}

}
