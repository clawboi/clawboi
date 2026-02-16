import { CONFIG } from "./config.js";
import { dist2, randi } from "./utils.js";

export class PickupManager{
  constructor(){
    this.shards = [];
    this.collected = 0;
    this.total = CONFIG.SHARDS_TOTAL;
  }

  reset(total = CONFIG.SHARDS_TOTAL){
    this.shards.length = 0;
    this.collected = 0;
    this.total = total;
  }

  addShard(x,y){
    this.shards.push({x,y,r:6, got:false});
  }

  done(){ return this.collected >= this.total; }

  update(dt){ /* no-op safe */ }

  tryCollect(player){
    for (const s of this.shards){
      if (s.got) continue;
      if (dist2(player.x, player.y, s.x, s.y) <= (player.r+s.r)*(player.r+s.r)){
        s.got = true;
        this.collected++;
        return true;
      }
    }
    return false;
  }

  draw(ctx, camX, camY){
    for (const s of this.shards){
      if (s.got) continue;
      const x = (s.x - camX)|0;
      const y = (s.y - camY)|0;
      ctx.fillStyle = "rgba(179,136,255,0.95)";
      ctx.fillRect(x-2,y-2,4,4);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(x-1,y-3,2,1);
    }
  }
}

