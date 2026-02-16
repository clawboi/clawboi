import { CONFIG } from "./config.js";
import { randi, rand } from "./utils.js";

export class WorldForest{
  constructor(seed = (Math.random()*1e9)|0){
    this.seed = seed;
    this.worldW = CONFIG.FOREST_W;
    this.worldH = CONFIG.FOREST_H;

    this.spawn = { x: 120, y: 120 };
    this.portal = { x: this.worldW - 140, y: this.worldH - 120, r: 14, active:false };

    // make a cheap “blocked” field (trees)
    this.blocks = [];
    const trees = 520;
    for (let i=0;i<trees;i++){
      const x = randi(20, this.worldW-20);
      const y = randi(20, this.worldH-20);
      const r = randi(6, 14);
      // keep spawn area open
      const dx = x - this.spawn.x, dy = y - this.spawn.y;
      if (dx*dx + dy*dy < 120*120) continue;
      this.blocks.push({x,y,r});
    }
  }

  setPortalActive(v){ this.portal.active = !!v; }

  isBlockedCircle(x, y, r){
    if (x < r || y < r || x > this.worldW - r || y > this.worldH - r) return true;

    for (const b of this.blocks){
      const dx = x - b.x, dy = y - b.y;
      const rr = (r + b.r);
      if (dx*dx + dy*dy <= rr*rr) return true;
    }
    return false;
  }

  inPortal(x, y, r){
    const p = this.portal;
    const dx = x - p.x, dy = y - p.y;
    return p.active && (dx*dx + dy*dy <= (p.r + r)*(p.r + r));
  }

  draw(ctx, camX, camY, t){
    // background tiles
    const w = CONFIG.WIDTH, h = CONFIG.HEIGHT;

    // parallax fog
    ctx.fillStyle = "rgba(10,10,16,1)";
    ctx.fillRect(0,0,w,h);

    // ground pattern
    for (let y=0;y<h;y+=8){
      for (let x=0;x<w;x+=8){
        const wx = x + camX;
        const wy = y + camY;
        const n = ((wx*0.07 + wy*0.05 + this.seed*0.00001) | 0) & 1;
        ctx.fillStyle = n ? "rgba(10,28,20,1)" : "rgba(9,24,18,1)";
        ctx.fillRect(x,y,8,8);
      }
    }

    // trees (blocks)
    for (const b of this.blocks){
      const x = (b.x - camX) | 0;
      const y = (b.y - camY) | 0;
      if (x<-30||y<-30||x>w+30||y>h+30) continue;

      ctx.fillStyle = "rgba(12,40,26,1)";
      ctx.fillRect(x-2, y-2, 4, 4);
      ctx.fillStyle = "rgba(8,18,14,0.75)";
      ctx.fillRect(x-3, y+2, 6, 3);
    }

    // portal
    const p = this.portal;
    const px = (p.x - camX) | 0;
    const py = (p.y - camY) | 0;

    if (p.active){
      ctx.fillStyle = "rgba(179,136,255,0.12)";
      ctx.beginPath();
      ctx.arc(px, py, 22 + Math.sin(t*3)*2, 0, Math.PI*2);
      ctx.fill();

      ctx.strokeStyle = "rgba(179,136,255,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI*2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI*2);
      ctx.stroke();
    }
  }
}

