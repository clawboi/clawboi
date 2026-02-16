import { clamp } from "./utils.js";

export class WorldForest {
  constructor({ tilesW=160, tilesH=120, tileSize=8, seed=1 }={}){
    this.tilesW = tilesW;
    this.tilesH = tilesH;
    this.tileSize = tileSize;
    this.seed = seed|0;

    this.worldW = this.tilesW * this.tileSize;
    this.worldH = this.tilesH * this.tileSize;

    // 0 floor, 1 wall
    this.tile = new Uint8Array(this.tilesW * this.tilesH);

    // ✅ IMPORTANT: expose BOTH names for minimap + other systems
    this.tiles = this.tile;

    // spawn and portal
    this.spawn = { x: (this.worldW*0.5)|0, y: (this.worldH*0.5)|0 };
    this.portal = { x: (this.worldW*0.5 + 220)|0, y: (this.worldH*0.5 - 120)|0, r:14, active:false };

    this._gen();
  }

  rnd(){
    // xorshift32
    this.seed ^= this.seed << 13; this.seed |= 0;
    this.seed ^= this.seed >>> 17; this.seed |= 0;
    this.seed ^= this.seed << 5;  this.seed |= 0;
    return (this.seed>>>0) / 4294967296;
  }

  idx(tx,ty){ return tx + ty*this.tilesW; }
  inb(tx,ty){ return tx>=0 && ty>=0 && tx<this.tilesW && ty<this.tilesH; }

  _set(tx,ty,v){
    if(this.inb(tx,ty)) this.tile[this.idx(tx,ty)] = v;
  }

  _get(tx,ty){
    if(!this.inb(tx,ty)) return 1;
    return this.tile[this.idx(tx,ty)];
  }

  _gen(){
    // Start blocked then carve paths (guaranteed corridors)
    this.tile.fill(1);

    const cx = (this.tilesW/2)|0;
    const cy = (this.tilesH/2)|0;

    // carve chunky main area
    for(let y=cy-12;y<=cy+12;y++){
      for(let x=cx-16;x<=cx+16;x++){
        this._set(x,y,0);
      }
    }

    // carve random walk corridors
    let x=cx, y=cy;
    for(let i=0;i<4200;i++){
      this._set(x,y,0);
      // widen corridor
      if(this.rnd()<0.32){ this._set(x+1,y,0); this._set(x,y+1,0); }
      if(this.rnd()<0.12){ this._set(x-1,y,0); this._set(x,y-1,0); }

      if(this.rnd() < 0.5) x += (this.rnd()<0.5 ? 1 : -1);
      else y += (this.rnd()<0.5 ? 1 : -1);

      x = clamp(x, 2, this.tilesW-3);
      y = clamp(y, 2, this.tilesH-3);
    }

    // add “rooms”
    for(let r=0;r<8;r++){
      const rx = (this.rnd()*this.tilesW)|0;
      const ry = (this.rnd()*this.tilesH)|0;
      const rw = 6 + (this.rnd()*14)|0;
      const rh = 6 + (this.rnd()*10)|0;
      for(let yy=ry;yy<ry+rh;yy++){
        for(let xx=rx;xx<rx+rw;xx++){
          if(this.inb(xx,yy)) this._set(xx,yy,0);
        }
      }
    }

    // set spawn on nearest open tile
    const s = this._findNearestOpen(cx, cy);
    this.spawn.x = (s.tx*this.tileSize + this.tileSize/2)|0;
    this.spawn.y = (s.ty*this.tileSize + this.tileSize/2)|0;

    // portal location: nearest open around target
    const pt = this._findNearestOpen((cx+26)|0, (cy-14)|0);
    this.portal.x = (pt.tx*this.tileSize + this.tileSize/2)|0;
    this.portal.y = (pt.ty*this.tileSize + this.tileSize/2)|0;
  }

  _findNearestOpen(tx,ty){
    tx = clamp(tx, 1, this.tilesW-2);
    ty = clamp(ty, 1, this.tilesH-2);
    if(this._get(tx,ty) === 0) return {tx,ty};

    const maxR = 40;
    for(let r=1;r<maxR;r++){
      for(let oy=-r; oy<=r; oy++){
        for(let ox=-r; ox<=r; ox++){
          const nx = tx+ox, ny = ty+oy;
          if(!this.inb(nx,ny)) continue;
          if(this._get(nx,ny)===0) return {tx:nx,ty:ny};
        }
      }
    }
    return {tx,ty};
  }

  /* ---------- collision (circle vs tiles) ---------- */
  isBlockedCircle(px,py,r){
    const ts = this.tileSize;

    const minTx = ((px - r) / ts)|0;
    const maxTx = ((px + r) / ts)|0;
    const minTy = ((py - r) / ts)|0;
    const maxTy = ((py + r) / ts)|0;

    for(let ty=minTy; ty<=maxTy; ty++){
      for(let tx=minTx; tx<=maxTx; tx++){
        if(this._get(tx,ty) !== 1) continue;

        // tile AABB in world px
        const ax = tx*ts, ay = ty*ts;
        const bx = ax+ts, by = ay+ts;

        // circle vs AABB
        const cx = clamp(px, ax, bx);
        const cy = clamp(py, ay, by);
        const dx = px - cx, dy = py - cy;
        if(dx*dx + dy*dy < r*r) return true;
      }
    }
    return false;
  }

  /* ---------- content helpers ---------- */
  setPortalActive(on){
    this.portal.active = !!on;
  }

  inPortal(px,py,r){
    if(!this.portal.active) return false;
    const d = Math.hypot(px - this.portal.x, py - this.portal.y);
    return d < (r + this.portal.r);
  }

  /* ---------- drawing ---------- */
  draw(ctx, camX, camY, t=0){
    const vw = 320, vh = 180;
    ctx.fillStyle = "#071012";
    ctx.fillRect(0,0,vw,vh);

    const ts = this.tileSize;

    const startTx = clamp((camX/ts)|0, 0, this.tilesW-1);
    const startTy = clamp((camY/ts)|0, 0, this.tilesH-1);
    const endTx = clamp(((camX+vw)/ts)|0 + 1, 0, this.tilesW);
    const endTy = clamp(((camY+vh)/ts)|0 + 1, 0, this.tilesH);

    for(let ty=startTy; ty<endTy; ty++){
      for(let tx=startTx; tx<endTx; tx++){
        const v = this.tile[this.idx(tx,ty)];
        const x = tx*ts - camX;
        const y = ty*ts - camY;

        if(v===0){
          const n = (tx*17 + ty*13) & 7;
          ctx.fillStyle = n<3 ? "#0b1b14" : "#0c2017";
          ctx.fillRect(x,y,ts,ts);

          if(((tx*19 + ty*11) & 63) === 0){
            ctx.fillStyle = "rgba(138,46,255,0.35)";
            ctx.fillRect(x+3,y+3,2,2);
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(x+4,y+2,1,1);
          }
        }else{
          ctx.fillStyle = "#07070d";
          ctx.fillRect(x,y,ts,ts);
          ctx.fillStyle = "rgba(138,46,255,0.08)";
          ctx.fillRect(x+1,y+1,ts-2,ts-2);
        }
      }
    }

    ctx.fillStyle = "rgba(10,4,18,0.12)";
    ctx.fillRect(0,0,vw,vh);

    this._drawPortal(ctx, camX, camY, t);
  }

  _drawPortal(ctx, camX, camY, t){
    const x = (this.portal.x - camX)|0;
    const y = (this.portal.y - camY)|0;

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x-10,y-10,20,20);

    if(!this.portal.active){
      ctx.fillStyle = "rgba(138,46,255,0.16)";
      ctx.fillRect(x-2,y-2,4,4);
      return;
    }

    const pulse = 0.5 + 0.5*Math.sin(t*5.0);

    ctx.fillStyle = `rgba(138,46,255,${0.20 + pulse*0.25})`;
    ctx.fillRect(x-16,y-16,32,32);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(x-2,y-12,4,24);
    ctx.fillRect(x-12,y-2,24,4);

    for(let i=0;i<10;i++){
      const a = t*1.2 + i*(Math.PI*2/10);
      const px = (x + Math.cos(a)*(12 + pulse*3))|0;
      const py = (y + Math.sin(a)*(12 + pulse*3))|0;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(px,py,1,1);
    }
  }
}
