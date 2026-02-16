export class World{
  constructor({w=256,h=256,seed=1}={}){
    this.w=w; this.h=h; this.seed=seed|0;

    this.bounds = { w: this.w, h: this.h };

    // spawn
    this.spawnX = (this.w/2)|0;
    this.spawnY = (this.h/2)|0;

    // objective node (set in gen)
    this.node = { x: this.spawnX, y: this.spawnY, r: 7 };

    // simple tilemap: 0 floor, 1 blocked
    this.tile = new Uint8Array(this.w*this.h);

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

  // carve a “walkable” disk
  clearDisk(cx,cy,r){
    const r2 = r*r;
    for(let y=cy-r; y<=cy+r; y++){
      for(let x=cx-r; x<=cx+r; x++){
        if(!this.inb(x,y)) continue;
        const dx=x-cx, dy=y-cy;
        if(dx*dx+dy*dy <= r2) this.tile[this.idx(x,y)] = 0;
      }
    }
  }

  // carve a chunky corridor line (Bresenham-ish + thickness)
  carveCorridor(x0,y0,x1,y1,thick=2){
    let x=x0|0, y=y0|0;
    const dx = Math.abs((x1|0) - x);
    const dy = Math.abs((y1|0) - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let err = dx - dy;

    for(let i=0;i<5000;i++){
      this.clearDisk(x,y,thick+1);

      if(x=== (x1|0) && y=== (y1|0)) break;
      const e2 = err*2;
      if(e2 > -dy){ err -= dy; x += sx; }
      if(e2 <  dx){ err += dx; y += sy; }

      if(!this.inb(x,y)) break;
    }
  }

  pickNode(){
    // pick a node far-ish from spawn, inside bounds
    // distance 70..105 feels good for a 256 map
    const a = this.rnd() * Math.PI * 2;
    const d = 74 + this.rnd() * 34;
    let x = (this.spawnX + Math.cos(a)*d) | 0;
    let y = (this.spawnY + Math.sin(a)*d) | 0;

    x = Math.max(16, Math.min(this.w-16, x));
    y = Math.max(16, Math.min(this.h-16, y));

    this.node.x = x;
    this.node.y = y;
  }

  gen(){
    // start as grass everywhere (0)
    this.tile.fill(0);

    // pick node position first
    this.pickNode();

    // corridor spine: spawn -> node
    this.carveCorridor(this.spawnX, this.spawnY, this.node.x, this.node.y, 3);

    // keep spawn + node areas open
    this.clearDisk(this.spawnX, this.spawnY, 10);
    this.clearDisk(this.node.x, this.node.y, 12);

    // scatter obstacles (trees/rocks)
    // slightly lower density + never block the corridor disks we carved
    const tries = (this.w*this.h*0.16)|0;
    for(let i=0;i<tries;i++){
      const px = (this.rnd()*this.w)|0;
      const py = (this.rnd()*this.h)|0;

      // protect spawn + node
      const ds = Math.hypot(px-this.spawnX, py-this.spawnY);
      const dn = Math.hypot(px-this.node.x,  py-this.node.y);
      if(ds < 14 || dn < 16) continue;

      // gentle “biome” bias: more blockers away from the corridor core
      if(this.rnd() < 0.52) this.tile[this.idx(px,py)] = 1;
    }

    // extra clean pass so the corridor never gets jaggedly blocked
    this.carveCorridor(this.spawnX, this.spawnY, this.node.x, this.node.y, 3);
    this.clearDisk(this.spawnX, this.spawnY, 10);
    this.clearDisk(this.node.x, this.node.y, 12);
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

  // Step 3 will call this to detect objective completion
  isAtNode(x,y){
    const dx = x - this.node.x;
    const dy = y - this.node.y;
    return (dx*dx + dy*dy) <= (this.node.r*this.node.r);
  }

  draw(ctx, camX, camY, effects){
    const vw = 320, vh = 180;

    // background base
    ctx.fillStyle = "#071012";
    ctx.fillRect(0,0,vw,vh);

    // draw tiles (sharp)
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
          // blocker
          ctx.fillStyle = "#0a0a10";
          ctx.fillRect(sx,sy,1,1);
        }
      }
    }

    // ===== Forest Node landmark (beacon) =====
    const nx = (this.node.x - camX) | 0;
    const ny = (this.node.y - camY) | 0;

    // only draw if in view-ish (tiny perf guard)
    if(nx > -40 && ny > -60 && nx < vw+40 && ny < vh+60){
      // pulse uses hallucination to feel “alive”
      const t = (performance.now()*0.001);
      const pulse = 0.55 + 0.45*Math.sin(t*2.4);
      const haze = 0.10 + pulse*0.14 + effects.hallucination*0.10;

      // beacon column
      ctx.fillStyle = `rgba(138,46,255,${haze})`;
      ctx.fillRect(nx-1, ny-26, 3, 22);

      // rune base
      ctx.fillStyle = "rgba(10,0,16,0.85)";
      ctx.fillRect(nx-4, ny-3, 9, 7);

      ctx.fillStyle = `rgba(138,46,255,${0.75 + pulse*0.20})`;
      ctx.fillRect(nx-2, ny-1, 5, 3);

      // sparkle crown
      ctx.fillStyle = `rgba(255,255,255,${0.40 + pulse*0.35})`;
      ctx.fillRect(nx, ny-28, 1, 1);
      ctx.fillRect(nx-2, ny-24, 1, 1);
      ctx.fillRect(nx+2, ny-22, 1, 1);
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
