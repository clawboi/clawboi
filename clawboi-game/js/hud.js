export function drawHUD(ctx,p){

ctx.fillStyle="rgba(0,0,0,.5)";
ctx.fillRect(8,8,180,60);

ctx.fillStyle="#ff4a7a";
ctx.fillRect(16,16,150*(p.hp/p.hpMax),8);

ctx.fillStyle="#b388ff";
ctx.fillRect(16,30,150*(p.xp/p.next),6);

ctx.fillStyle="#fff";
ctx.fillText("LV "+p.level,16,52);

}
