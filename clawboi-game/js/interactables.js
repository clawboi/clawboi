import { dist2 } from "./utils.js";

export class Interactables{
  constructor(){
    this.list = [];
    this.prompt = "";
  }

  reset(){
    this.list.length = 0;
    this.prompt = "";
  }

  add(type, x, y, data={}){
    this.list.push({ type, x, y, r: 10, data });
  }

  tryInteract(player, pressed){
    this.prompt = "";
    let best = null;
    let bestD = Infinity;

    for (const o of this.list){
      const rr = (player.r + o.r);
      const d = dist2(player.x, player.y, o.x, o.y);
      if (d <= rr*rr){
        if (d < bestD){
          bestD = d;
          best = o;
        }
      }
    }

    if (best){
      if (best.type === "note") this.prompt = "E: READ NOTE";
      if (best.type === "chest") this.prompt = "E: OPEN CHEST";
      if (best.type === "key") this.prompt = "E: TAKE KEY";
      if (best.type === "gate") this.prompt = "E: USE GATE";
      if (best.type === "entrance") this.prompt = "E: ENTER NODE";
      if (best.type === "exit") this.prompt = "E: EXIT";

      if (pressed){
        return { type: best.type, obj: best };
      }
    }
    return null;
  }

  draw(ctx, camX, camY){
    for (const o of this.list){
      const x = (o.x - camX)|0;
      const y = (o.y - camY)|0;

      if (o.type === "note"){
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillRect(x-2,y-2,4,4);
      } else if (o.type === "chest"){
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(x-4,y-3,8,6);
        ctx.fillStyle = "rgba(179,136,255,0.35)";
        ctx.fillRect(x-2,y-1,4,2);
      } else if (o.type === "key"){
        ctx.fillStyle = "rgba(125,255,177,0.9)";
        ctx.fillRect(x-2,y-1,4,2);
        ctx.fillRect(x+2,y-1,2,1);
      } else if (o.type === "gate"){
        ctx.fillStyle = o.data.locked ? "rgba(255,74,122,0.55)" : "rgba(125,255,177,0.55)";
        ctx.fillRect(x-6,y-10,12,20);
      } else if (o.type === "entrance" || o.type === "exit"){
        ctx.strokeStyle = "rgba(179,136,255,0.75)";
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI*2);
        ctx.stroke();
      }
    }
  }
}
