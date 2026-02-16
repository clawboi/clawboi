// world.js
// Procedural forest map, collision, item spawns, parallax/fog.

window.World = (() => {
  const TILE = 16;
  const W = 140; // tiles wide
  const H = 140; // tiles high

  // tile types
  // 0 grass, 1 tree, 2 rock, 3 mushroom, 4 crystal, 5 potion
  const map = new Uint8Array(W*H);
  const solid = (t)=> (t===1 || t===2);

  const items = []; // {x,y,type,alive:true}
  const ambience = { particles: [] };

  function idx(x,y){ return y*W+x; }

  function gen(seed=1){
    // simple RNG
    let s = seed|0;
    const rng=()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)/4294967296); };

    // base grass
    map.fill(0);

    // tree clusters
    for(let i=0;i<2600;i++){
      const x = Math.floor(rng()*W);
      const y = Math.floor(rng()*H);
      const r = 1 + Math.floor(rng()*3);
      for(let yy=-r;yy<=r;yy++){
        for(let xx=-r;xx<=r;xx++){
          const nx=x+xx, ny=y+yy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          if(rng() < 0.35) map[idx(nx,ny)] = 1;
        }
      }
    }

    // rocks
    for(let i=0;i<1100;i++){
      const x = Math.floor(rng()*W);
      const y = Math.floor(rng()*H);
      if(map[idx(x,y)]===0 && rng()<0.7) map[idx(x,y)] = 2;
    }

    // glowing mushrooms + crystals + potions as collectibles
    items.length=0;
    const spawnItem = (type, n)=>{
      for(let i=0;i<n;i++){
        const x = Math.floor(rng()*W);
        const y = Math.floor(rng()*H);
        if(map[idx(x,y)]!==0) continue;
        // keep some spacing
        items.push({x:x*TILE+8, y:y*TILE+8, type, alive:true, bob:rng()*Math.PI*2});
      }
    };
    spawnItem("mushroom", 120);
    spawnItem("crystal", 70);
    spawnItem("potion", 45);

    // ambient particles
    ambience.particles.length=0;
    for(let i=0;i<120;i++){
      ambience.particles.push({
        x: rng()*(W*TILE),
        y: rng()*(H*TILE),
        vx: (rng()*0.16+0.02)*(rng()<0.5?-1:1),
        vy: (rng()*0.16+0.02)*(rng()<0.5?-1:1),
        a: rng()*0.35+0.10,
        s: rng()*1.5+0.5
      });
    }
  }

  function tileAt(px,py){
    const x = Math.floor(px/TILE);
    const y = Math.floor(py/TILE);
    if(x<0||y<0||x>=W||y>=H) return 1; // out of bounds solid
    return map[idx(x,y)];
  }

  function isSolidAt(px,py){
    return solid(tileAt(px,py));
  }

  function clampToWorld(p){
    p.x = Math.max(8, Math.min(p.x, W*TILE-8));
    p.y = Math.max(8, Math.min(p.y, H*TILE-8));
  }

  function draw(ctx, cam, t, halluAmt){
    // parallax back: deep blue haze + faint stars
    const px = cam.x, py = cam.y;
    ctx.save();
    ctx.fillStyle = "#050507";
    ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

    // parallax star dots
    const sx = (-px*0.08) % 64;
    const sy = (-py*0.08) % 64;
    ctx.globalAlpha = 0.22 + halluAmt*0.10;
    for(let y=0;y<ctx.canvas.height+64;y+=64){
      for(let x=0;x<ctx.canvas.width+64;x+=64){
        ctx.fillStyle = "rgba(255,255,255,.25)";
        ctx.fillRect(x+sx+10, y+sy+14, 1, 1);
        ctx.fillStyle = "rgba(138,46,255,.25)";
        ctx.fillRect(x+sx+42, y+sy+36, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // visible tiles
    const vw = ctx.canvas.width;
    const vh = ctx.canvas.height;

    const x0 = Math.floor(px/TILE);
    const y0 = Math.floor(py/TILE);
    const x1 = x0 + Math.ceil(vw/TILE)+2;
    const y1 = y0 + Math.ceil(vh/TILE)+2;

    for(let y=y0;y<y1;y++){
      for(let x=x0;x<x1;x++){
        if(x<0||y<0||x>=W||y>=H) continue;
        const t = map[idx(x,y)];
        const sx = x*TILE - px;
        const sy = y*TILE - py;

        // grass
        if(t===0){
          ctx.fillStyle = "rgba(20,18,30,1)";
          ctx.fillRect(sx,sy,TILE,TILE);
          // subtle noise blades
          ctx.fillStyle = "rgba(60,60,80,.18)";
          ctx.fillRect(sx+((x+y)%4), sy+((x*3+y)%5), 1, 2);
        }

        // tree (solid)
        if(t===1){
          ctx.fillStyle = "rgba(12,12,16,1)";
          ctx.fillRect(sx,sy,TILE,TILE);
          // trunk
          ctx.fillStyle="rgba(30,22,40,1)";
          ctx.fillRect(sx+7, sy+8, 2, 6);
          // canopy glow hints
          ctx.fillStyle="rgba(138,46,255,.14)";
          ctx.fillRect(sx+3, sy+2, 10, 6);
        }

        // rock (solid)
        if(t===2){
          ctx.fillStyle="rgba(15,15,20,1)";
          ctx.fillRect(sx,sy,TILE,TILE);
          ctx.fillStyle="rgba(90,90,110,.22)";
          ctx.fillRect(sx+5,sy+6,6,5);
        }
      }
    }

    // draw items
    for(const it of items){
      if(!it.alive) continue;
      const x = it.x - px;
      const y = it.y - py + Math.sin(t*2 + it.bob)*2;

      if(x<-20||y<-20||x>vw+20||y>vh+20) continue;

      if(it.type==="mushroom"){
        ctx.fillStyle="rgba(138,46,255,.65)";
        ctx.fillRect(x-2,y-2,4,4);
        ctx.fillStyle="rgba(255,255,255,.22)";
        ctx.fillRect(x-1,y-3,2,1);
      }
      if(it.type==="crystal"){
        ctx.fillStyle="rgba(138,46,255,.85)";
        ctx.fillRect(x-2,y-4,4,8);
        ctx.fillStyle="rgba(255,255,255,.18)";
        ctx.fillRect(x-1,y-4,2,2);
      }
      if(it.type==="potion"){
        ctx.fillStyle="rgba(255,255,255,.22)";
        ctx.fillRect(x-3,y-3,6,6);
        ctx.fillStyle="rgba(138,46,255,.65)";
        ctx.fillRect(x-2,y-2,4,4);
      }
    }

    // ambient particles (fog motes)
    ctx.save();
    ctx.globalAlpha = 0.18 + halluAmt*0.10;
    for(const p of ambience.particles){
      const x = p.x - px;
      const y = p.y - py;
      if(x<-10||y<-10||x>vw+10||y>vh+10) continue;
      ctx.fillStyle = `rgba(138,46,255,${p.a})`;
      ctx.fillRect(x, y, p.s, p.s);
    }
    ctx.restore();

    // fog layer overlay
    ctx.save();
    const fog = 0.10 + halluAmt*0.08;
    ctx.globalAlpha = fog;
    ctx.fillStyle = "rgba(255,255,255,1)";
    // cheap fog pattern stripes
    for(let i=0;i<vh;i+=8){
      ctx.globalAlpha = fog*(0.65+0.35*Math.sin(t*0.7 + i*0.04));
      ctx.fillRect(0,i,vw,1);
    }
    ctx.restore();
  }

  function update(dt){
    // drift ambient particles
    for(const p of ambience.particles){
      p.x += p.vx;
      p.y += p.vy;
      if(p.x<0) p.x += W*TILE;
      if(p.y<0) p.y += H*TILE;
      if(p.x>W*TILE) p.x -= W*TILE;
      if(p.y>H*TILE) p.y -= H*TILE;
    }
  }

  return {
    TILE, W, H,
    map, items,
    gen, draw, update,
    tileAt, isSolidAt, clampToWorld
  };
})();

