import {Entity} from "./entity.js";
import {Physics} from "./physics.js";
import {M} from "./math.js";

export class Boss extends Entity{

constructor(x,y){
super(x,y,22);
this.hp=300;
}

update(dt,world,player){

let a=M.angle(this.x,this.y,player.x,player.y);

this.vx=Math.cos(a)*50;
this.vy=Math.sin(a)*50;

Physics.move(this,dt);

if(this.hp<=0)this.dead=true;
}

draw(ctx,cam){
ctx.fillStyle="#ff006e";
ctx.beginPath();
ctx.arc(this.x-cam.x,this.y-cam.y,this.r,0,7);
ctx.fill();
}

hit(d){
this.hp-=d;
}

}
