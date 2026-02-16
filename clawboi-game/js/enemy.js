import {Entity} from "./entity.js";
import {Physics} from "./physics.js";
import {M} from "./math.js";
import {CONFIG} from "./config.js";

export class Enemy extends Entity{

constructor(x,y){
super(x,y,6);
this.hp=20;
}

update(dt,world,player){

let ang=M.angle(this.x,this.y,player.x,player.y);
this.vx=Math.cos(ang)*CONFIG.ENEMY_SPEED;
this.vy=Math.sin(ang)*CONFIG.ENEMY_SPEED;

Physics.move(this,dt);

if(this.hp<=0)this.dead=true;
}

draw(ctx,cam){
ctx.fillStyle="#ff3b6e";
ctx.beginPath();
ctx.arc(this.x-cam.x,this.y-cam.y,this.r,0,7);
ctx.fill();
}

}
