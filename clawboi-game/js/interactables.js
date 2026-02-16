export class Interactables{

constructor(){this.list=[]}

add(type,x,y,data={}){
this.list.push({type,x,y,data,r:10});
}

try(player){

for(let o of this.list){
let dx=o.x-player.x;
let dy=o.y-player.y;
if(dx*dx+dy*dy<120){
return o;
}
}
return null;
}

draw(ctx,cam){
ctx.fillStyle="#ffe066";
for(let o of this.list)
ctx.fillRect(o.x-cam.x,o.y-cam.y,6,6);
}

}
