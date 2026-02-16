import {World} from "./worldBase.js";

export class WorldNode extends World{

constructor(){
super(900,900);
this.spawn={x:450,y:450};
}

draw(ctx,cam){
ctx.fillStyle="#140f22";
ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

ctx.strokeStyle="#7b2cff";
ctx.strokeRect(200-cam.x,200-cam.y,500,500);
}

}
