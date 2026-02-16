export class Pickups{

constructor(){
this.shards=[];
this.need=3;
}

spawn(x,y){
this.shards.push({x,y,r:6});
}

collect(player){
let c=0;
this.shards=this.shards.filter(s=>{
let dx=s.x-player.x;
let dy=s.y-player.y;
if(dx*dx+dy*dy<120){
c++; return false;
}
return true;
});
return c;
}

draw(ctx,cam){
ctx.fillStyle="#b388ff";
for(let s of this.shards)
ctx.fillRect(s.x-cam.x,s.y-cam.y,6,6);
}

done(){
return this.shards.length===0;
}

}
