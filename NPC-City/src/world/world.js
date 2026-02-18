// Simple hand-built “town” using rectangles (fast to start, easy to expand)
// Later: you can swap this to JSON maps without changing the engine.

export class World {
  constructor(){
    // World size in “pixels” (game units)
    this.w = 2600;
    this.h = 1600;

    // Named spawn zones per role
    this.spawns = {
      thug:  { x: 420,  y: 1180, area:"South Side" },
      actor: { x: 1320, y: 520,  area:"Studio Row" },
      police:{ x: 2140, y: 980,  area:"Civic District" },
    };

    // Static colliders (buildings, fences, etc.)
    this.solids = [
      // big blocks (pretend buildings)
      { x: 240, y: 1040, w: 420, h: 260 },
      { x: 860, y: 1080, w: 520, h: 220 },
      { x: 1100, y: 260, w: 640, h: 320 },  // studio lot
      { x: 1840, y: 820, w: 520, h: 360 },  // civic building
      { x: 2100, y: 500, w: 360, h: 220 },

      // fences/alleys
      { x: 720, y: 930, w: 40, h: 520 },
      { x: 1700, y: 540, w: 40, h: 520 },
    ];

    // “Landmarks” to label on the ground (for orientation)
    this.landmarks = [
      { x: 380,  y: 1120, text:"Bodega" },
      { x: 1240, y: 420,  text:"Studio Gate" },
      { x: 2120, y: 900,  text:"Police HQ" },
      { x: 1560, y: 1260, text:"Bus Stop" },
    ];

    // Cosmetic roads (just rectangles, non-solid)
    this.roads = [
      { x: 0, y: 760, w: this.w, h: 220 },
      { x: 1220, y: 0, w: 260, h: this.h },
    ];
  }

  getSpawn(role){
    return this.spawns[role] || this.spawns.actor;
  }

  // collision test for axis-aligned rectangles
  hitsSolid(rect){
    for (const s of this.solids){
      if (aabb(rect, s)) return true;
    }
    return false;
  }

  draw(ctx, cam){
    // Background ground
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    // Parallax-ish subtle grid
    ctx.save();
    ctx.translate(-cam.x % 40, -cam.y % 40);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    for (let gx=0; gx<cam.vw+40; gx+=40){
      for (let gy=0; gy<cam.vh+40; gy+=40){
        ctx.fillRect(gx, gy, 1, 1);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // World draw with camera transform
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Roads
    ctx.fillStyle = "#141423";
    for (const r of this.roads){
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Sidewalk/curb accent
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (const r of this.roads){
      ctx.fillRect(r.x, r.y, r.w, 6);
      ctx.fillRect(r.x, r.y+r.h-6, r.w, 6);
    }

    // Buildings (solids)
    ctx.fillStyle = "#1c1c2b";
    for (const s of this.solids){
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }

    // Building “rooftop” highlight
    ctx.fillStyle = "rgba(138,46,255,.18)";
    for (const s of this.solids){
      ctx.fillRect(s.x, s.y, s.w, 10);
    }

    // Landmark labels on ground
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const lm of this.landmarks){
      ctx.fillText(lm.text, lm.x, lm.y);
    }

    // World bounds debug outline (nice while building)
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.strokeRect(0, 0, this.w, this.h);

    ctx.restore();
  }
}

function aabb(a,b){
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

