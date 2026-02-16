import { dist2 } from "./utils.js";

export class Interactables{
  constructor(){
    this.items = [];
    this.prompt = "";
  }

  reset(){
    this.items.length = 0;
    this.prompt = "";
  }

  add(type, x, y, data={}){
    this.items.push({type,x,y,r:10,data});
  }

  update(dt){ /* safe no-op */ }

  tryInteract(player, pressed){
    this.prompt = "";
    let best = null;
    let bestD = 1e18;

    for (const it of this.items){
      const d = dist2(player.x, player.y, it.x, it.y);
      if (d < bestD){
        bestD = d;
        best = it;
      }
    }

    if (best && bestD < 26*26){
      this.prompt = "E: INTERACT";
      if (pressed) return { type: best.type, obj: best };
    }
    return null;
  }

  draw(ctx, camX, camY){
    for (const it of this.items){
      const x = (it.x - camX)|0;
      const y = (it.y - camY)|0;

      if (it.type === "chest"){
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x-4,y-3,8,6);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x-1,y-1,2,2);
      }

      if (it.type === "gate"){
        ctx.strokeStyle = "rgba(179,136,255,0.45)";
        ctx.strokeRect(x-6,y-10,12,20);
      }

      if (it.type === "key"){
        ctx.fillStyle = "rgba(125,255,177,0.85)";
        ctx.fillRect(x-2,y-1,4,2);
        ctx.fillRect(x+1,y-2,1,4);
      }
    }
  }
}

