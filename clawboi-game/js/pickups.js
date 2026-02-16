import { dist2 } from "./utils.js";

export class PickupManager{
  constructor(){
    this.shards = [];
    this.collected = 0;
    this.target = 3;
  }

  reset(target=3){
    this.target = target;
    this.collected = 0;
    this.shards.length = 0;
  }

  addShard(x, y){
    this.shards.push({ x, y, r: 4, alive:true });
  }

  done(){
    return this.collected >= this.target;
  }

  update(dt){ (void)dt; }

  collect(player){
    for (const s of this.shards){
      if (!s.alive) continue;
      const rr = (player.r + s.r + 2);
      if (dist2(player.x, player.y, s.x, s.y) <= rr*rr){
        s.alive = false;
        this.collected++;
        return true;
      }
    }
    return false;
  }

  draw(ctx, camX, camY){
    for (const s of this.shards){
      if (!s.alive) continue;
      const x = (s.x - camX)|0;
      const y = (s.y - camY)|0;

      ctx.fillStyle = "rgba(179,136,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
