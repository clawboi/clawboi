export class MenuScene{

update(){}

draw(ctx){
ctx.fillStyle="#000";
ctx.fillRect(0,0,320,180);

ctx.fillStyle="#a855ff";
ctx.font="20px monospace";
ctx.textAlign="center";
ctx.fillText("ADVENTURES OF CLAWBOI",160,80);

ctx.fillStyle="#fff";
ctx.font="12px monospace";
ctx.fillText("CLICK TO START",160,110);
}

}
