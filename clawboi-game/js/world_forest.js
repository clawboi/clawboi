export class WorldForest{
  constructor(){
    this.tileSize = 8;
    this.tilesW = 80;
    this.tilesH = 60;
    this.worldW = this.tilesW * this.tileSize;
    this.worldH = this.tilesH * this.tileSize;

    this.spawn = { x: 80, y: 80 };
    this.portal = { x: this.worldW - 70, y: this.worldH - 60, r: 12 };
    this.portalActive = false;

    // simple obstacle fields
    this.blocks = [];
    for (let i=0;i<26;i++){
      const x = 40 + Math.random()*(this.worldW-80);
      const y = 40 + Math.random()*(this.worldH-80);
      const w = 12 + Math.random()*26;
      const h = 12 + Math.random()*26;
      this.blocks.push({ x,y,w,h });
    }
  }

  setPortalActive(on){ this.portalActive = !!on; }

  isBlockedCircle(x, y, r){
    // bounds
    if (x < r || y < r || x > this.worldW - r || y > this.worldH - r) return true;

    // obstacles
    for (const b of this.blocks){
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy <= r*r) return true;
    }
    return false;
  }

  tryMoveCircle(x0, y0, x1, y1, r){
    // simple slide: try full, else x, else y, else stay
    if (!this.isBlockedCircle(x1, y1, r)) return { x:x1, y:y1 };
    if (!this.isBlockedCircle(x1, y0, r)) return { x:x1, y:y0 };
    if (!this.isBlockedCircle(x0, y1, r)) return { x:x0, y:y1 };
    return { x:x0, y:y0 };
  }

  inPortal(x, y, r){
    if (!this.portalActive) return false;
    const dx = x - this.portal.x;
    const dy = y - this.portal.y;
    const rr = (this.portal.r + r);
    return (dx*dx + dy*dy) <= rr*rr;
  }

  draw(ctx, camX, camY, t){
    // background “forest noise”
    ctx.fillStyle = "rgba(10,12,18,1)";
    ctx.fillRect(0,0,320,180);

    // subtle tiles
    for (let y=0;y<180;y+=8){
      for (let x=0;x<320;x+=8){
        const v = ((x+y + ((t*10)|0)) & 16) ? 0.08 : 0.05;
        ctx.fillStyle = `rgba(20,40,32,${v})`;
        ctx.fillRect(x, y, 8, 8);
      }
    }

    // obstacles
    for (const b of this.blocks){
      const x = (b.x - camX)|0;
      const y = (b.y - camY)|0;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = "rgba(179,136,255,0.08)";
      ctx.strokeRect(x+0.5, y+0.5, b.w-1, b.h-1);
    }

    // portal
    const px = (this.portal.x - camX)|0;
    const py = (this.portal.y - camY)|0;

    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI*2);
    ctx.strokeStyle = this.portalActive ? "rgba(179,136,255,0.85)" : "rgba(179,136,255,0.15)";
    ctx.stroke();

    if (this.portalActive){
      ctx.fillStyle = "rgba(179,136,255,0.10)";
      ctx.beginPath();
      ctx.arc(px, py, 12 + Math.sin(t*4)*1.5, 0, Math.PI*2);
      ctx.fill();
    }

    // border vignette
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0,0,320,8);
    ctx.fillRect(0,172,320,8);
    ctx.fillRect(0,0,8,180);
    ctx.fillRect(312,0,8,180);
  }
}
