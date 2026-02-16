import { clamp } from "./utils.js";

export class Interactables {
  constructor(){
    this.list = [];
    this.prompt = ""; // current prompt string for HUD
  }

  reset(){
    this.list.length = 0;
    this.prompt = "";
  }

  add(type, x, y, data={}){
    this.list.push({
      id: `${type}_${(Math.random()*1e9|0)}`,
      type, x, y,
      r: data.r ?? 10,
      used: false,
      data
    });
  }

  nearest(player){
    let best = null;
    let bestD = 1e9;
    for(const o of this.list){
      if(o.used && (o.type==="chest" || o.type==="note" || o.type==="key")) continue;
      const dx = o.x - player.x;
      const dy = o.y - player.y;
      const d = Math.hypot(dx,dy);
      if(d < bestD){
        bestD = d;
        best = o;
      }
    }
    return { obj: best, dist: bestD };
  }

  // returns an event object when interaction triggers
  tryInteract(player, pressed){
    this.prompt = "";

    const {obj, dist} = this.nearest(player);
    if(!obj) return null;

    const within = dist <= (obj.r + player.r + 6);

    if(within){
      // set prompt text based on type
      if(obj.type === "chest") this.prompt = "E: OPEN CHEST";
      if(obj.type === "note")  this.prompt = "E: READ NOTE";
      if(obj.type === "key")   this.prompt = "E: TAKE KEY";
      if(obj.type === "gate")  this.prompt = "E: OPEN GATE";
      if(obj.type === "entrance") this.prompt = "E: ENTER NODE";
      if(obj.type === "exit") this.prompt = "E: EXIT NODE";
    }

    if(!pressed || !within) return null;

    // consume interaction based on type
    if(obj.type === "chest"){
      if(obj.used) return null;
      obj.used = true;
      return { type:"chest", obj };
    }

    if(obj.type === "note"){
      if(obj.used) return null;
      obj.used = true;
      return { type:"note", obj };
    }

    if(obj.type === "key"){
      if(obj.used) return null;
      obj.used = true;
      return { type:"key", obj };
    }

    if(obj.type === "gate"){
      if(obj.data.locked === false) return null;
      return { type:"gate", obj };
    }

    if(obj.type === "entrance"){
      return { type:"entrance", obj };
    }

    if(obj.type === "exit"){
      return { type:"exit", obj };
    }

    return null;
  }

  draw(ctx, camX, camY){
    for(const o of this.list){
      // hide used items
      if(o.used && (o.type==="chest" || o.type==="note" || o.type==="key")) continue;

      const x = (o.x - camX)|0;
      const y = (o.y - camY)|0;

      if(o.type === "chest"){
        // little pixel chest
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(x-6,y-4,12,8);
        ctx.fillStyle = "rgba(138,46,255,0.95)";
        ctx.fillRect(x-6,y-1,12,2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x+2,y-3,2,2);
      }

      if(o.type === "note"){
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x-4,y-5,8,10);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x-3,y-3,6,1);
        ctx.fillRect(x-3,y-1,5,1);
      }

      if(o.type === "key"){
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x-1,y-3,2,8);
        ctx.fillRect(x-4,y-3,3,2);
        ctx.fillRect(x+1,y-1,3,2);
        ctx.fillStyle = "rgba(138,46,255,0.85)";
        ctx.fillRect(x-2,y+4,4,2);
      }

      if(o.type === "gate"){
        // a chunky vertical bar gate
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x-8,y-12,16,24);
        ctx.fillStyle = "rgba(138,46,255,0.75)";
        ctx.fillRect(x-6,y-10,2,20);
        ctx.fillRect(x-2,y-10,2,20);
        ctx.fillRect(x+2,y-10,2,20);
        ctx.fillRect(x+6,y-10,2,20);
      }

      if(o.type === "entrance" || o.type === "exit"){
        ctx.fillStyle = "rgba(138,46,255,0.25)";
        ctx.fillRect(x-10,y-10,20,20);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillRect(x-2,y-2,4,4);
      }
    }
  }
}

