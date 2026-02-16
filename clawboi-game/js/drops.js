import { dist2 } from "./utils.js";

export class DropManager{
  constructor(){
    this.items = [];
  }
  reset(){
    this.items.length = 0;
  }
  spawnHP(x,y,amt=1){
    this.items.push({x,y,r:5, amt});
  }
  update(dt){ /* no-op safe */ }

  tryCollect(player){
    let got = 0;
    for (const it of this.items){
      if (it.got) continue;
      if (dist2(player.x, player.y, it.x, it.y) <= (player.r+it.r)*(player.r+it.r)){
        it.got = true;
        got += it.amt;
      }
    }
    // remove old
    if (got>0) this.items = this.items.filter(i=>!i.got);
    return got;
  }

  draw(ctx, camX, camY){
    for (const it of this.items){
      const x = (it.x - camX)|0;
      const y = (it.y - camY)|0;
      ctx.fillStyle = "rgba(125,255,177,0.85)";
      ctx.fillRect(x-2,y-2,4,4);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-1,y-1,2,2);
    }
  }
}

