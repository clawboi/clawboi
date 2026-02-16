import {M} from "./math.js";
import {CONFIG} from "./config.js";

export class Camera{

constructor(w,h){
this.x=0;
this.y=0;
this.w=w;
this.h=h;
this.worldW=w;
this.worldH=h;
this.shake=0;
this.t=0;
}

setWorld(w,h){
this.worldW=w;
this.worldH=h;
}

follow(dt,x,y){

this.x=M.lerp(this.x,x-this.w/2,CONFIG.CAM_LERP*dt);
this.y=M.lerp(this.y,y-this.h/2,CONFIG.CAM_LERP*dt);

this.x=M.clamp(this.x,0,this.worldW-this.w);
this.y=M.clamp(this.y,0,this.worldH-this.h);

if(this.t>0){
this.t-=dt;
this.shake*=1-dt*CONFIG.SHAKE_DECAY;
}else this.shake=0;
}

kick(p,t){
this.shake=p;
this.t=t;
}

offset(){
return{
x:this.x+(Math.random()-.5)*this.shake,
y:this.y+(Math.random()-.5)*this.shake
};
}

}
