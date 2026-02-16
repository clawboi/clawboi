import {Enemy} from "./enemy.js";
import {M} from "./math.js";

export class EnemyManager{

constructor(world){
this.world=world;
this.list=[];
}

spawn(x,y,n){
for(let i=0;i<n;i++){
let a=Math.random()*6.28;
let d=80+Math.random()*120;
this.list.push(new Enemy(x+Math.cos(a)*d,y+Math.sin(a)*d));
}
}

update(dt,player){
for(let e of this.list)
if(!e.dead)e.update(dt,this.world,player);
}

draw(ctx,cam){
for(let e of this.list)
if(!e.dead)e.draw(ctx,cam);
}

hits(hb){
let c=0;
for(let e of this.list){
if(e.dead)continue;
let dx=e.x-hb.x;
let dy=e.y-hb.y;
if(dx*dx+dy*dy<(hb.r+e.r)*(hb.r+e.r)){
e.hp-=hb.dmg;
c++;
}
}
return c;
}

alive(){
return this.list.filter(e=>!e.dead).length;
}

}
