import { dist2 } from "./utils.js";

export class DropManager{
  constructor(){
    this.list = [];
  }

  reset(){ this.list.length = 0; }

  spawn(x, y, count=1){
    for(let i=0;i<count;i++){
      this.list.push({
        x: x + (Math.random()*10-5),
        y: y + (Math.random()*10-5),
        r: 3,
        t: 7,
        value: 1
      });
    }
  }

  update(dt){
    for (const d of this.list){
      d.t -= dt;
    }
    this.list = this.list.filter(d => d.t > 0);
  }

  collect(player){
    let got = 0;
    for (const d of this.list){
      const rr = (player.r + d.r + 2);
      if (dist2(player.x, player.y, d.x, d.y) <= rr*rr){
        got += d.value;
        d.t = -1;
      }
    }
    this.list = this.list.filter(d => d.t > 0);
    return got;
  }

  draw(ctx, camX, camY){
    for (const d of this.list){
      const x = (d.x - camX)|0;
      const y = (d.y - camY)|0;

      ctx.fillStyle = "rgba(125,255,177,0.85)";
      ctx.fillRect(x-1, y-1, 2, 2);
    }
  }
}
