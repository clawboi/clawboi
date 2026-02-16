export class TitleScene{

update(){}

draw(ctx){
ctx.fillStyle="#05050a";
ctx.fillRect(0,0,320,180);

ctx.fillStyle="#c084ff";
ctx.font="22px monospace";
ctx.textAlign="center";
ctx.fillText("CLAWBOI",160,80);

ctx.font="12px monospace";
ctx.fillText("THE COSMIC RPG",160,110);
}

}
