export class World{
  constructor({w=256,h=256,seed=1}={}){
    this.w=w; this.h=h; this.seed=seed|0;

    this.bounds = { w: this.w, h: this.h };

    // spawn
    this.spawnX = (this.w/2)|0;
    this.spawnY = (this.h/2)|0;

    // simple tilemap: 0 floor, 1 blocked
    this.tile = new Uint8Array(this.w*this.h);

    // generate: paths + trees + rocks
    this.gen();
  }

  rnd(){
    // xorshift32
    this.seed ^= this.seed << 13; this.seed |= 0;
    this.seed ^= this.seed >>> 17; this.seed |= 0;
    this.seed ^= this.seed << 5;  this.seed |= 0;
    return (this.seed>>>0)/4294967296;
  }

  idx(x,y){ return x + y*this.w; }
  inb(x,y){ return x>=0 && y>=0 && x<this.w && y<this.h; }

  gen(){
    // base: grass everywhere
    this.tile.fill(0);

    // carve a few corridors
    let x=this.spawnX, y=this.spawnY;
    for(let i=0;i<1400;i++){
      this.tile[this.idx(x,y)] = 0;
      if(this.rnd()<0.5) x += (this.rnd()<0.5?1:-1);
      else y += (this.rnd()<0.5?1:-1);
      x = Math.max(2, Math.min(this.w-3, x));
      y = Math.max(2, Math.min(this.h-3, y));
    }

    // scatter obstacles (trees/rocks)
    for(let i=0;i<this.w*this.h*0.18;i++){
      const px = (this.rnd()*this.w)|0;
      const py = (this.rnd()*this.h)|0;
      const d = Math.hypot(px-this.spawnX, py-this.spawnY);
      if(d < 14) continue;
      if(this.rnd() < 0.55) this.tile[this.idx(px,py)] = 1;
    }
  }

  isBlocked(x,y,r=0){
    const ix = x|0, iy=y|0;
    // sample a few points around circle
    const pts = [
      [ix,iy],[ix+r,iy],[ix-r,iy],[ix,iy+r],[ix,iy-r]
    ];
    for(const [px,py] of pts){
      if(!this.inb(px,py)) return true;
      if(this.tile[this.idx(px,py)] === 1) return true;
    }
    return false;
  }

  draw(ctx, camX, camY, effects){
    const vw = 320, vh = 180;

    // background gradient "real RPG vibe" base
    ctx.fillStyle = "#071012";
    ctx.fillRect(0,0,vw,vh);

    // draw tiles (cheap + sharp)
    const startX = Math.max(0, camX);
    const startY = Math.max(0, camY);
    const endX = Math.min(this.w, camX + vw + 1);
    const endY = Math.min(this.h, camY + vh + 1);

    for(let y=startY; y<endY; y++){
      for(let x=startX; x<endX; x++){
        const t = this.tile[this.idx(x,y)];
        const sx = x - camX;
        const sy = y - camY;

        if(t===0){
          // grass pixel
          ctx.fillStyle = ( (x+y)&1 ) ? "#0b1b14" : "#0c2017";
          ctx.fillRect(sx,sy,1,1);

          // occasional mushroom glow
          if(((x*17+y*13)&63)===0){
            ctx.fillStyle = "rgba(138,46,255,0.55)";
            ctx.fillRect(sx,sy,1,1);
          }
        }else{
          // tree/rock blocker
          ctx.fillStyle = "#0a0a10";
          ctx.fillRect(sx,sy,1,1);
        }
      }
    }

    // fog layer
    const fog = 0.12 + effects.hallucination*0.18;
    ctx.fillStyle = `rgba(10,4,18,${fog})`;
    ctx.fillRect(0,0,vw,vh);

    // vignette
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0,0,vw,6);
    ctx.fillRect(0,vh-6,vw,6);
    ctx.fillRect(0,0,6,vh);
    ctx.fillRect(vw-6,0,6,vh);
  }
}
