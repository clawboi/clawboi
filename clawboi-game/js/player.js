import {Entity} from "./entity.js";
import {CONFIG} from "./config.js";
import {Physics} from "./physics.js";
import {M} from "./math.js";

export class Player extends Entity{

constructor(x,y){
super(x,y,6);

this.speed=CONFIG.PLAYER_SPEED;
this.hp=100;
this.hpMax=100;
this.level=1;
this.xp=0;
this.next=20;

this.dashT=0;
this.dashCD=0;

this.atkCD=0;
this.face={x:1,y:0};
}

gain(n){
this.xp+=n;
if(this.xp>=this.next){
this.xp=0;
this.level++;
this.next=Math.floor(this.next*1.4);
this.hp=this.hpMax;
}
}

update(dt,input,world){

let mx=input.mx();
let my=input.my();

let len=Math.hypot(mx,my)||1;
mx/=len; my/=len;

if(mx||my)this.face={x:mx,y:my};

if(this.dashCD>0)this.dashCD-=dt;

if(input.dash()&&this.dashCD<=0){
this.dashT=CONFIG.DASH_TIME;
this.dashCD=CONFIG.DASH_CD;
}

if(this.dashT>0){
this.dashT-=dt;
this.vx=this.face.x*CONFIG.DASH_SPEED;
this.vy=this.face.y*CONFIG.DASH_SPEED;
}else{
this.vx=mx*this.speed;
this.vy=my*this.speed;
}

Physics.move(this,dt);

this.x=M.clamp(this.x,0,world.worldW);
this.y=M.clamp(this.y,0,world.worldH);

if(this.atkCD>0)this.atkCD-=dt;
}

attack(){
if(this.atkCD>0)return null;
this.atkCD=CONFIG.ATTACK_CD;
return{
x:this.x+this.face.x*14,
y:this.y+this.face.y*14,
r:16,
dmg:12+this.level*2
};
}

draw(ctx,cam){
ctx.fillStyle="#a855ff";
ctx.beginPath();
ctx.arc(this.x-cam.x,this.y-cam.y,this.r,0,7);
ctx.fill();
}

}
