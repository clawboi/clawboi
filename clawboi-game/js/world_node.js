import { CONFIG } from "./config.js";

export class WorldNode{
  constructor(){
    this.worldW = CONFIG.NODE_W;
    this.worldH = CONFIG.NODE_H;

    this.spawn = { x: 80, y: 80 };
    this.portal = { x: this.worldW - 90, y: this.worldH - 70, r: 14 };
    this._walls = [];

    // simple rectangular walls
    this._walls.push({x: 70, y: 40, w: this.worldW-140, h: 8});
    this._walls.push({x: 40, y: 70, w: 8, h: this.worldH-140});
    this._walls.push({x: this.worldW-48, y: 70, w: 8, h: this.worldH-140});
    this._walls.push({x: 70, y: this.worldH-48, w: this.worldW-140, h: 8});
  }

  isBlockedCircle(x, y, r){
    if (x < r || y < r || x > this.worldW - r || y > this.worldH - r) return true;
    for (const w of this._walls){
      const nx = Math.max(w.x, Math.min(x, w.x+w.w));
      const ny = Math.max(w.y, Math.min(y, w.y+w.h));
      const dx = x - nx, dy = y - ny;
      if (dx*dx + dy*dy <= r*r) return true;
    }
    return false;
  }

  inPortal(x, y, r){
    const p = this.portal;
    const dx = x - p.x, dy = y - p.y;
    return (dx*dx + dy*dy) <= (p.r + r)*(p.r + r);
  }

  draw(ctx, camX, camY, t){
    const w = CONFIG.WIDTH, h = CONFIG.HEIGHT;
    ctx.fillStyle = "rgba(8,8,14,1)";
    ctx.fillRect(0,0,w,h);

    // grid
    for (let y=0;y<h;y+=8){
      for (let x=0;x<w;x+=8){
        ctx.fillStyle = ((x+y)>>3)&1 ? "rgba(18,18,28,1)" : "rgba(16,16,24,1)";
        ctx.fillRect(x,y,8,8);
      }
    }

    // walls
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (const W of this._walls){
      const x = (W.x - camX)|0;
      const y = (W.y - camY)|0;
      ctx.fillRect(x,y,W.w,W.h);
    }

    // portal glow
    const p = this.portal;
    const px = (p.x - camX)|0;
    const py = (p.y - camY)|0;

    ctx.fillStyle = "rgba(255,74,122,0.10)";
    ctx.beginPath();
    ctx.arc(px, py, 22 + Math.sin(t*4)*2, 0, Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,74,122,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI*2);
    ctx.stroke();
  }
}

