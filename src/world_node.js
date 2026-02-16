// src/world_node.js

export class WorldNode {
  constructor(){
    this.tilesW = 80;
    this.tilesH = 60;
    this.tileSize = 8;

    this.worldW = this.tilesW * this.tileSize;
    this.worldH = this.tilesH * this.tileSize;

    // 0 floor, 1 wall
    this.tiles = new Uint8Array(this.tilesW * this.tilesH);

    this.spawn = { x: (this.worldW/2)|0, y: (this.worldH - 80)|0 };
    this.portal = { x: (this.worldW/2)|0, y: 70 }; // exit marker

    this._gen();
  }

  idx(x,y){ return x + y*this.tilesW; }
  inb(x,y){ return x>=0 && y>=0 && x<this.tilesW && y<this.tilesH; }

  _gen(){
    // outer walls
    for(let y=0;y<this.tilesH;y++){
      for(let x=0;x<this.tilesW;x++){
        const wall = (x===0||y===0||x===this.tilesW-1||y===this.tilesH-1);
        this.tiles[this.idx(x,y)] = wall ? 1 : 0;
      }
    }

    // central ring
    const cx = (this.tilesW/2)|0;
    const cy = (this.tilesH/2)|0;
    for(let y=cy-14;y<=cy+14;y++){
      for(let x=cx-20;x<=cx+20;x++){
        const edge = (x===cx-20||x===cx+20||y===cy-14||y===cy+14);
        if(edge) this.tiles[this.idx(x,y)] = 1;
      }
    }

    // openings
    for(let x=cx-2;x<=cx+2;x++){
      this.tiles[this.idx(x, cy+14)] = 0;
      this.tiles[this.idx(x, cy-14)] = 0;
    }
  }

  isBlockedCircle(x,y,r){
    const pts = [[x,y],[x+r,y],[x-r,y],[x,y+r],[x,y-r]];
    for(const [px,py] of pts){
      const tx = (px/this.tileSize)|0;
      const ty = (py/this.tileSize)|0;
      if(!this.inb(tx,ty)) return true;
      if(this.tiles[this.idx(tx,ty)] === 1) return true;
    }
    return false;
  }

  draw(ctx, camX, camY, t=0){
    const vw = ctx.canvas.width, vh = ctx.canvas.height;

    ctx.fillStyle = "#050508";
    ctx.fillRect(0,0,vw,vh);

    const ts = this.tileSize;

    const startX = clamp0((camX/ts)|0, 0, this.tilesW-1);
    const startY = clamp0((camY/ts)|0, 0, this.tilesH-1);
    const endX   = clamp0(((camX+vw)/ts)|0 + 1, 0, this.tilesW);
    const endY   = clamp0(((camY+vh)/ts)|0 + 1, 0, this.tilesH);

    for(let ty=startY; ty<endY; ty++){
      for(let tx=startX; tx<endX; tx++){
        const t0 = this.tiles[this.idx(tx,ty)];
        const x = tx*ts - camX;
        const y = ty*ts - camY;

        if(t0===0){
          ctx.fillStyle = ((tx+ty)&1) ? "#0b0b12" : "#0a0a10";
          ctx.fillRect(x,y,ts,ts);

          if(((tx*11+ty*7)&63)===0){
            ctx.fillStyle = "rgba(138,46,255,0.18)";
            ctx.fillRect(x+2,y+2,2,2);
          }
        }else{
          ctx.fillStyle = "#0a0a10";
          ctx.fillRect(x,y,ts,ts);
          ctx.fillStyle = "rgba(138,46,255,0.08)";
          ctx.fillRect(x+1,y+1,ts-2,ts-2);
        }
      }
    }

    // portal marker
    const px = (this.portal.x - camX)|0;
    const py = (this.portal.y - camY)|0;
    ctx.fillStyle = "rgba(138,46,255,0.20)";
    ctx.fillRect(px-10, py-10, 20, 20);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(px-2, py-2, 4, 4);
  }

  inPortal(x,y,r){
    const dx = x - this.portal.x;
    const dy = y - this.portal.y;
    return (dx*dx + dy*dy) < (18*18);
  }
}

function clamp0(n,a,b){ return Math.max(a, Math.min(b,n)); }
