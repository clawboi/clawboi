export function overlay(ctx,w,h,title,sub){

ctx.fillStyle="rgba(0,0,0,.7)";
ctx.fillRect(0,0,w,h);

ctx.fillStyle="#c084ff";
ctx.font="18px monospace";
ctx.textAlign="center";
ctx.fillText(title,w/2,h/2-10);

ctx.fillStyle="#fff";
ctx.font="12px monospace";
ctx.fillText(sub,w/2,h/2+12);

}
