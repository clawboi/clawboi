export class Portal{

constructor(x,y){
this.x=x;
this.y=y;
this.r=18;
this.active=false;
}

draw(ctx,cam){
if(!this.active)return;
ctx.strokeStyle="#a855ff";
ctx.beginPath();
ctx.arc(this.x-cam.x,this.y-cam.y,this.r,0,7);
ctx.stroke();
}

check(player){
if(!this.active)return false;
let dx=player.x-this.x;
let dy=player.y-this.y;
return dx*dx+dy*dy<this.r*this.r;
}

}
