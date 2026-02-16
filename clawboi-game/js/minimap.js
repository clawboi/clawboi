export function drawMini(ctx,world,player){

let w=100;
let h=70;

ctx.fillStyle="rgba(0,0,0,.5)";
ctx.fillRect(210,10,w,h);

ctx.fillStyle="#999";
ctx.fillRect(
210+(player.x/world.worldW)*w,
10+(player.y/world.worldH)*h,
3,3
);

}
