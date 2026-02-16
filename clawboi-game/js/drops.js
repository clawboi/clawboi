export class Drops{

constructor(){this.list=[]}

spawn(x,y,n){
for(let i=0;i<n;i++)
this.list.push({x,y,r:4});
}

update(dt,player){
for(let d of this.list){
let dx=player.x-d.x;
let dy=player.y-d.y;
if(dx*dx+dy*dy<2000){
d.x+=dx*.05;
d.y+=dy*.05;
}
}
}

collect(player){
let got=0;
this.list=this.list.filter(d=>{
let dx=d.x-player.x;
let dy=d.y-player.y;
if(dx*dx+dy*dy<100){
got++; return false;
}
return true;
});
return got;
}

draw(ctx,cam){
ctx.fillStyle="#7bffb0";
for(let d of this.list)
ctx.fillRect(d.x-cam.x,d.y-cam.y,3,3);
}

}
