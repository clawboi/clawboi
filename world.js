/* =========================================================
   WORLD MODULE — Forest Overworld (Pixel RPG)
   - tile-based world with collision grid
   - colored like a real RPG (paths, clearings, canopy shadows)
   - parallax background
   - fog layers + ambient particles
   - glowing mushrooms + violet crystals + potions (collectibles)
   - camera follow with smoothing
   - pixel-perfect rendering (no blur; your main canvas should be image-rendering: pixelated)
   ========================================================= */

const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
const rand  = (a,b)=> a + Math.random()*(b-a);
const rint  = (a,b)=> Math.floor(rand(a,b+1));
const pick  = (arr)=> arr[Math.floor(Math.random()*arr.length)];

function hash2(x,y,seed=1337){
  // deterministic pseudo-random 0..1
  let n = (x*374761393 + y*668265263 + seed*1442695041) | 0;
  n = (n ^ (n>>>13)) | 0;
  n = (n * 1274126177) | 0;
  n = (n ^ (n>>>16)) | 0;
  return (n>>>0) / 4294967296;
}

function smoothstep(t){ return t*t*(3-2*t); }

export class World{
  constructor(opts={}){
    // TILE SETTINGS
    this.tile = opts.tile ?? 16;
    this.wTiles = opts.wTiles ?? 96;     // 96*16 = 1536 px
    this.hTiles = opts.hTiles ?? 72;     // 72*16 = 1152 px

    this.widthPx  = this.wTiles * this.tile;
    this.heightPx = this.hTiles * this.tile;

    // CAMERA
    this.camX = 0;
    this.camY = 0;
    this.camSmoothing = 0.12;

    // WORLD ARRAYS
    this.blocked = new Uint8Array(this.wTiles * this.hTiles); // 1 = solid
    this.type = new Uint8Array(this.wTiles * this.hTiles);    // tile type ids

    // COLLECTIBLES
    this.items = []; // {id, kind, x,y, r, glow, taken:false}
    this._itemId = 1;

    // AMBIENT PARTICLES
    this.particles = []; // {x,y,vx,vy,a,life,kind}
    this._pt = 0;

    // FOG LAYERS
    this.fog = [
      {t:0, speed:0.016, a:0.16, scale:1.0},
      {t:0, speed:0.010, a:0.10, scale:1.25},
    ];

    // PARALLAX "SKY"
    this.stars = [];
    this._initSky();

    // COLOR PALETTE (RPG-ish)
    this.P = {
      deep:   "#05040a",
      night:  "#090617",
      grass1: "#0f1a12",
      grass2: "#122516",
      moss:   "#17301b",
      path1:  "#1a1b22",
      path2:  "#24202c",
      rock1:  "#2a2a34",
      rock2:  "#3a3a46",
      bark:   "#1c141a",
      leaf1:  "#141f17",
      leaf2:  "#1b2b1f",
      leaf3:  "#223725",
      glowV:  "#8a2eff",
      glowW:  "rgba(255,255,255,0.85)",
      mist:   "rgba(140,80,255,0.10)",
      mist2:  "rgba(255,255,255,0.06)"
    };

    // Generate
    this._generate();
    this._spawnItems();
  }

  /* ===========================
     GENERATION
     =========================== */
  _generate(){
    const W=this.wTiles, H=this.hTiles;

    // Base: grass noise fields + some pathing
    // Tile types:
    // 0 grass, 1 darker grass, 2 path, 3 rock, 4 stump/tree base (blocked), 5 water-ish puddle (cosmetic)
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const n = hash2(x,y,777);
        const n2= hash2(x,y,222);

        // create "clearings" by lowering density near some centers
        const clearing = this._clearingField(x,y);

        let t=0;
        if(n < 0.35 + clearing*0.20) t=1; // darker grass
        if(n2 < 0.06 && clearing < 0.65) t=3; // rocks
        if(hash2(x,y,999) < 0.02 && clearing < 0.55) t=5; // puddles (cosmetic)

        this.type[y*W+x]=t;
      }
    }

    // Carve winding paths (so it feels like a world)
    const pathCount = 3;
    for(let i=0;i<pathCount;i++){
      this._carvePath(
        rint(6, W-6), rint(6,H-6),
        rint(6, W-6), rint(6,H-6),
        rint(2,3)
      );
    }

    // Place tree clusters (blocked) leaving paths + clearings
    this.blocked.fill(0);
    for(let y=2;y<H-2;y++){
      for(let x=2;x<W-2;x++){
        const idx=y*W+x;
        const t=this.type[idx];

        // don't block paths
        if(t===2) continue;

        const n = hash2(x,y,333);
        const clearing = this._clearingField(x,y);

        // density higher away from clearings
        const density = 0.12 + (0.45*(1-clearing));

        // tree bases
        if(n < density && t!==5){
          // keep some breathing room
          if(this._nearPath(x,y,2)) continue;
          this.type[idx]=4;
          this.blocked[idx]=1;
        }
      }
    }

    // extra rock blocking occasionally
    for(let y=2;y<H-2;y++){
      for(let x=2;x<W-2;x++){
        const idx=y*W+x;
        if(this.type[idx]===3 && hash2(x,y,555)<0.40 && !this._nearPath(x,y,1)){
          // some rocks are solid
          this.blocked[idx]=1;
        }
      }
    }

    // Make a safe spawn clearing (center-ish) and keep it unblocked
    this._clearArea(Math.floor(W*0.5), Math.floor(H*0.55), 6);
  }

  _clearingField(x,y){
    // several soft clearings
    const centers = [
      {x:Math.floor(this.wTiles*0.50), y:Math.floor(this.hTiles*0.55), r:18},
      {x:Math.floor(this.wTiles*0.22), y:Math.floor(this.hTiles*0.30), r:14},
      {x:Math.floor(this.wTiles*0.78), y:Math.floor(this.hTiles*0.28), r:15},
      {x:Math.floor(this.wTiles*0.68), y:Math.floor(this.hTiles*0.72), r:16},
    ];
    let v=0;
    for(const c of centers){
      const dx=(x-c.x), dy=(y-c.y);
      const d=Math.hypot(dx,dy);
      const t=clamp(1 - d/c.r, 0, 1);
      v=Math.max(v, smoothstep(t));
    }
    return v; // 0..1
  }

  _nearPath(x,y,r){
    for(let yy=-r; yy<=r; yy++){
      for(let xx=-r; xx<=r; xx++){
        const nx=x+xx, ny=y+yy;
        if(nx<0||ny<0||nx>=this.wTiles||ny>=this.hTiles) continue;
        if(this.type[ny*this.wTiles+nx]===2) return true;
      }
    }
    return false;
  }

  _clearArea(cx,cy,r){
    for(let y=cy-r;y<=cy+r;y++){
      for(let x=cx-r;x<=cx+r;x++){
        if(x<0||y<0||x>=this.wTiles||y>=this.hTiles) continue;
        const idx=y*this.wTiles+x;
        this.blocked[idx]=0;
        // clear to grass (keep paths if present)
        if(this.type[idx]!==2) this.type[idx]=0;
      }
    }
  }

  _carvePath(x1,y1,x2,y2,width){
    // wiggly path using a stepping walker
    let x=x1, y=y1;
    const W=this.wTiles, H=this.hTiles;
    const steps = Math.floor(Math.hypot(x2-x1,y2-y1) * 2.2);
    for(let i=0;i<steps;i++){
      const t=i/Math.max(1,steps-1);
      const tx = Math.floor(lerp(x1,x2,t) + Math.sin(t*6 + x1*0.1)*2);
      const ty = Math.floor(lerp(y1,y2,t) + Math.cos(t*5 + y1*0.1)*2);

      x += clamp(tx-x, -1, 1);
      y += clamp(ty-y, -1, 1);

      x = clamp(x, 2, W-3);
      y = clamp(y, 2, H-3);

      // paint path
      for(let yy=-width; yy<=width; yy++){
        for(let xx=-width; xx<=width; xx++){
          const nx=x+xx, ny=y+yy;
          if(nx<1||ny<1||nx>=W-1||ny>=H-1) continue;
          const d=Math.hypot(xx,yy);
          if(d<=width+0.2){
            const idx=ny*W+nx;
            this.type[idx]=2;
            this.blocked[idx]=0;
          }
        }
      }
    }
  }

  _initSky(){
    this.stars.length=0;
    const count = 220;
    for(let i=0;i<count;i++){
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random()*1.5 + 0.3,
        a: Math.random()*0.7 + 0.1,
        tw: Math.random()*0.9 + 0.1
      });
    }
  }

  /* ===========================
     ITEMS
     =========================== */
  _spawnItems(){
    // mushrooms, crystals, potions in interesting places
    const W=this.wTiles, H=this.hTiles;
    const wantM = 26;
    const wantC = 18;
    const wantP = 8;

    const place = (kind, tries=400)=>{
      for(let i=0;i<tries;i++){
        const x=rint(3,W-4), y=rint(3,H-4);
        const idx=y*W+x;
        if(this.blocked[idx]) continue;
        if(this.type[idx]===5) continue;

        // prefer off-path a bit but not too deep
        const nearP = this._nearPath(x,y,2);
        const clearing = this._clearingField(x,y);
        const ok =
          (kind==="mushroom" ? (!nearP && clearing<0.7) :
           kind==="crystal"  ? (clearing<0.6) :
           /* potion */       (nearP || clearing>0.55));

        if(!ok) continue;

        this.items.push({
          id: this._itemId++,
          kind,
          x: x*this.tile + rint(3, this.tile-3),
          y: y*this.tile + rint(3, this.tile-3),
          r: kind==="crystal"? 8 : 7,
          glow: kind==="potion"? 0.9 : 0.7,
          taken:false
        });
        return true;
      }
      return false;
    };

    for(let i=0;i<wantM;i++) place("mushroom");
    for(let i=0;i<wantC;i++) place("crystal");
    for(let i=0;i<wantP;i++) place("potion");
  }

  /* Called from main.js each frame */
  update(dt, player, effects){
    // camera follow
    this._updateCamera(dt, player);

    // ambient particles
    this._pt += dt;
    if(this._pt>0.04){
      this._pt=0;
      this._spawnAmbient(player);
    }
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.life -= dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      p.a *= 0.995;
      if(p.life<=0 || p.a<0.01) this.particles.splice(i,1);
    }

    // fog drift
    for(const f of this.fog){
      f.t += dt*f.speed;
    }

    // item pickups
    this._checkPickups(player, effects);
  }

  _updateCamera(dt, player){
    const targetX = (player.x + player.width/2) - (window.innerWidth/2);
    const targetY = (player.y + player.height/2) - (window.innerHeight/2);

    const tx = clamp(targetX, 0, Math.max(0, this.widthPx - window.innerWidth));
    const ty = clamp(targetY, 0, Math.max(0, this.heightPx - window.innerHeight));

    this.camX = this.camX + (tx - this.camX) * (1 - Math.pow(1-this.camSmoothing, dt*60));
    this.camY = this.camY + (ty - this.camY) * (1 - Math.pow(1-this.camSmoothing, dt*60));
  }

  _spawnAmbient(player){
    // spawn around camera view for free vibes
    const x = this.camX + rand(0, window.innerWidth);
    const y = this.camY + rand(0, window.innerHeight);
    const kind = Math.random()<0.65 ? "dust" : "ember";
    const vx = rand(-6, 6);
    const vy = kind==="dust" ? rand(3, 10) : rand(-10, -2);
    const a  = kind==="dust" ? rand(0.03,0.08) : rand(0.05,0.12);
    const life = rand(1.4, 2.8);

    this.particles.push({x,y,vx,vy,a,life,kind});
    if(this.particles.length>220) this.particles.splice(0, this.particles.length-220);
  }

  _checkPickups(player, effects){
    const px = player.x + player.width/2;
    const py = player.y + player.height/2;
    for(const it of this.items){
      if(it.taken) continue;
      const d = Math.hypot(px-it.x, py-it.y);
      if(d < it.r + 10){
        it.taken = true;

        if(it.kind==="mushroom"){
          player.addXP(12);
          player.heal(6);
          effects?.spark?.(it.x,it.y,"violet", 10);
          effects?.ring?.(it.x,it.y, 28, "violet");
        }else if(it.kind==="crystal"){
          player.addXP(18);
          effects?.spark?.(it.x,it.y,"white", 12);
          effects?.ring?.(it.x,it.y, 34, "violet");
        }else if(it.kind==="potion"){
          // potion triggers hallucination mode (your main.js should manage timer)
          // We set a flag on player to reward hallucination XP more.
          player.hallucinationBonus = 0.35; // +35% XP while hallucinating
          effects?.setHallucination?.(true, 1);
          effects?.shake?.(4, 0.14);
          effects?.spark?.(it.x,it.y,"violet", 16);
          effects?.ring?.(it.x,it.y, 44, "violet");
        }
      }
    }
  }

  /* ===========================
     COLLISION API
     =========================== */
  isBlockedPx(px,py){
    // outside world is solid
    if(px<0 || py<0 || px>=this.widthPx || py>=this.heightPx) return true;
    const tx = Math.floor(px / this.tile);
    const ty = Math.floor(py / this.tile);
    const idx = ty*this.wTiles + tx;
    return this.blocked[idx]===1;
  }

  /* ===========================
     DRAW
     Pass ctx + camera + effects
     =========================== */
  draw(ctx, camX, camY, effects){
    // background parallax + darkness
    this._drawParallax(ctx, camX, camY, effects);

    // draw world tiles
    this._drawTiles(ctx, camX, camY);

    // canopy shadows overlay (makes it feel “RPG forest”)
    this._drawCanopyShade(ctx, camX, camY);

    // draw items (glowing)
    this._drawItems(ctx, camX, camY);

    // ambient particles
    this._drawParticles(ctx, camX, camY);

    // fog
    this._drawFog(ctx, camX, camY);
  }

  _drawParallax(ctx, camX, camY, effects){
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // base darkness
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.P.deep;
    ctx.fillRect(0,0,w,h);

    // starfield (parallax)
    const px = camX * 0.08;
    const py = camY * 0.06;

    for(const st of this.stars){
      const tw = 0.55 + 0.45*Math.sin(performance.now()*0.0018*st.tw + st.x*10);
      const x = (st.x*w - (px % w) + w) % w;
      const y = (st.y*h - (py % h) + h) % h;
      ctx.globalAlpha = st.a * tw * 0.55;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x, y, st.r, st.r);
    }

    // violet haze gradient
    ctx.globalAlpha = 0.20;
    const g = ctx.createRadialGradient(w*0.35,h*0.35, 10, w*0.5,h*0.5, Math.max(w,h)*0.85);
    g.addColorStop(0, "rgba(138,46,255,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    ctx.restore();
  }

  _drawTiles(ctx, camX, camY){
    const tile = this.tile;
    const W=this.wTiles, H=this.hTiles;

    // visible region
    const x0 = clamp(Math.floor(camX/tile)-2, 0, W-1);
    const y0 = clamp(Math.floor(camY/tile)-2, 0, H-1);
    const x1 = clamp(Math.ceil((camX+window.innerWidth)/tile)+2, 0, W);
    const y1 = clamp(Math.ceil((camY+window.innerHeight)/tile)+2, 0, H);

    for(let y=y0;y<y1;y++){
      for(let x=x0;x<x1;x++){
        const idx=y*W+x;
        const t=this.type[idx];

        const sx = Math.floor(x*tile - camX);
        const sy = Math.floor(y*tile - camY);

        // grass base variation
        if(t===0){
          ctx.fillStyle = (hash2(x,y,10)<0.5) ? this.P.grass1 : this.P.grass2;
          ctx.fillRect(sx,sy,tile,tile);

          // tiny specks
          if(hash2(x,y,11)<0.08){
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fillRect(sx+rint(2,13), sy+rint(2,13), 1,1);
          }
        }else if(t===1){
          ctx.fillStyle = (hash2(x,y,12)<0.5) ? this.P.moss : this.P.grass1;
          ctx.fillRect(sx,sy,tile,tile);
        }else if(t===2){
          // path tiles (two-tone + edge grit)
          ctx.fillStyle = (hash2(x,y,13)<0.5) ? this.P.path1 : this.P.path2;
          ctx.fillRect(sx,sy,tile,tile);

          // grit
          if(hash2(x,y,14)<0.35){
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.fillRect(sx+rint(2,13), sy+rint(2,13), 1,1);
          }
        }else if(t===3){
          // rocks
          ctx.fillStyle = (hash2(x,y,15)<0.5) ? this.P.rock1 : this.P.rock2;
          ctx.fillRect(sx,sy,tile,tile);

          // highlight chip
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(sx+rint(3,10), sy+rint(3,10), rint(2,4), 1);
        }else if(t===4){
          // tree base tile (blocked)
          // ground
          ctx.fillStyle = this.P.bark;
          ctx.fillRect(sx,sy,tile,tile);

          // trunk core
          ctx.fillStyle = "#0d0a10";
          ctx.fillRect(sx+5, sy+3, 6, 10);

          // violet fungus near base (RPG vibe)
          if(hash2(x,y,16)<0.22){
            ctx.fillStyle = "rgba(138,46,255,0.35)";
            ctx.fillRect(sx+3, sy+12, 10, 2);
          }
        }else if(t===5){
          // puddle
          ctx.fillStyle = "#0b0f1a";
          ctx.fillRect(sx,sy,tile,tile);
          ctx.fillStyle = "rgba(138,46,255,0.10)";
          ctx.fillRect(sx+2,sy+2,tile-4,tile-4);
        }
      }
    }
  }

  _drawCanopyShade(ctx, camX, camY){
    // Soft moving shadow blobs to simulate canopy
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();
    ctx.globalAlpha = 0.22;
    const t = performance.now()*0.0002;

    // 3 big blobs
    for(let i=0;i<3;i++){
      const bx = (Math.sin(t*1.4 + i*2.2)*0.5+0.5)*w;
      const by = (Math.cos(t*1.1 + i*1.7)*0.5+0.5)*h;
      const rad = Math.max(w,h) * (0.55 + i*0.08);

      const g = ctx.createRadialGradient(bx,by, 20, bx,by, rad);
      g.addColorStop(0, "rgba(0,0,0,0.30)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
    }

    // slight vignette
    ctx.globalAlpha = 0.30;
    const v = ctx.createRadialGradient(w/2,h/2, 10, w/2,h/2, Math.max(w,h)*0.70);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0,0,w,h);

    ctx.restore();
  }

  _drawItems(ctx, camX, camY){
    for(const it of this.items){
      if(it.taken) continue;
      const x = Math.floor(it.x - camX);
      const y = Math.floor(it.y - camY);

      // glow
      const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.006 + it.id);
      ctx.save();
      ctx.globalAlpha = 0.22 + pulse*0.16*it.glow;
      ctx.fillStyle = "rgba(138,46,255,0.9)";
      ctx.fillRect(x-8,y-8,16,16);

      ctx.globalAlpha = 1;

      if(it.kind==="mushroom"){
        // cap
        ctx.fillStyle = "#1a0f22";
        ctx.fillRect(x-3,y-3, 8,4);
        ctx.fillStyle = "#8a2eff";
        ctx.fillRect(x-2,y-2, 6,2);
        // stem
        ctx.fillStyle = "#e8e2ef";
        ctx.fillRect(x, y, 2, 5);
      }else if(it.kind==="crystal"){
        ctx.fillStyle = "#8a2eff";
        ctx.fillRect(x-2,y-6, 4,10);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(x-1,y-5, 1,8);
      }else if(it.kind==="potion"){
        ctx.fillStyle = "#0c0a10";
        ctx.fillRect(x-3,y-5, 6,8);
        ctx.fillStyle = "#8a2eff";
        ctx.fillRect(x-2,y-4, 4,6);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x-2,y-4, 1,5);
      }

      ctx.restore();
    }
  }

  _drawParticles(ctx, camX, camY){
    for(const p of this.particles){
      const x = Math.floor(p.x - camX);
      const y = Math.floor(p.y - camY);
      ctx.save();
      ctx.globalAlpha = p.a;
      if(p.kind==="ember"){
        ctx.fillStyle = "rgba(138,46,255,0.9)";
        ctx.fillRect(x,y,2,2);
      }else{
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x,y,1,1);
      }
      ctx.restore();
    }
  }

  _drawFog(ctx, camX, camY){
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();
    for(let i=0;i<this.fog.length;i++){
      const f=this.fog[i];
      const driftX = Math.sin(f.t*2 + i)*18;
      const driftY = Math.cos(f.t*1.6 + i)*10;

      ctx.globalAlpha = f.a;
      const g = ctx.createRadialGradient(
        w*0.35 + driftX, h*0.55 + driftY, 20,
        w*0.55 + driftX, h*0.55 + driftY, Math.max(w,h)*0.85*f.scale
      );
      g.addColorStop(0, this.P.mist);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      // extra thin mist sheet
      ctx.globalAlpha = f.a*0.55;
      ctx.fillStyle = this.P.mist2;
      const band = 18;
      for(let y=0;y<h;y+=band){
        const wob = Math.sin(f.t*6 + y*0.06)*6;
        ctx.fillRect(wob, y, w, 1);
      }
    }
    ctx.restore();
  }
}

// local lerp
function lerp(a,b,t){ return a+(b-a)*t; }
