import { clamp, rand, rint } from "./utils.js";

/*
 FX:
 - sparks (hits, pickups)
 - float texts (XP, HIT, HEAL, etc)
 - screen vignette + pulse + flash
 - light screen shake helper (camera already exists, but this adds overlay pulse)
*/

export class FX {
  constructor(){
    this.sparks = [];
    this.floaters = [];
    this.flash = 0;
    this.damagePulse = 0;
    this.goodPulse = 0;
    this.vignette = 0.22;
    this.t = 0;
  }

  reset(){
    this.sparks.length = 0;
    this.floaters.length = 0;
    this.flash = 0;
    this.damagePulse = 0;
    this.goodPulse = 0;
    this.t = 0;
  }

  update(dt){
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt*3.2);
    this.damagePulse = Math.max(0, this.damagePulse - dt*2.8);
    this.goodPulse = Math.max(0, this.goodPulse - dt*2.8);

    // sparks
    for(let i=this.sparks.length-1;i>=0;i--){
      const p = this.sparks[i];
      p.life -= dt;
      if(p.life <= 0){ this.sparks.splice(i,1); continue; }

      p.vx *= Math.pow(0.001, dt*2.8);
      p.vy *= Math.pow(0.001, dt*2.8);
      p.vy += p.g * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a *= 0.985;
    }

    // floaters
    for(let i=this.floaters.length-1;i>=0;i--){
      const f = this.floaters[i];
      f.t += dt;
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.001, dt*2.2);

      // fade in/out
      const p = clamp(f.t / f.dur, 0, 1);
      f.a = p < 0.2 ? (p/0.2) : (1 - (p-0.2)/0.8);
      f.a = clamp(f.a, 0, 1);

      if(f.t >= f.dur) this.floaters.splice(i,1);
    }
  }

  // big white flash
  hitFlash(str=0.16){
    this.flash = Math.max(this.flash, str);
  }

  pulseDamage(str=0.22){
    this.damagePulse = Math.max(this.damagePulse, str);
  }

  pulseGood(str=0.20){
    this.goodPulse = Math.max(this.goodPulse, str);
  }

  // Hit sparks
  sparksHit(x,y, count=14, kind="violet"){
    const hue = kind==="danger" ? "rgba(255,74,122," : "rgba(138,46,255,";
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const sp = rand(80, 280);
      this.sparks.push({
        x: x + rand(-2,2),
        y: y + rand(-2,2),
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp,
        g: rand(180, 520),
        r: rand(0.8, 1.8),
        a: rand(0.35, 0.85),
        col: hue,
        life: rand(0.22, 0.48)
      });
    }
    if(this.sparks.length > 900) this.sparks.splice(0, this.sparks.length-900);
  }

  // Pickup burst
  burst(x,y, count=12){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const sp = rand(40, 210);
      this.sparks.push({
        x: x + rand(-1,1),
        y: y + rand(-1,1),
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp,
        g: rand(60, 220),
        r: rand(0.8, 1.6),
        a: rand(0.30, 0.75),
        col: "rgba(255,255,255,",
        life: rand(0.18, 0.35)
      });
    }
  }

  // Floating text at world coords
  text(x,y, msg, kind=""){
    const col =
      kind==="danger" ? "rgba(255,74,122,1)" :
      kind==="good"   ? "rgba(125,255,177,1)" :
      kind==="violet" ? "rgba(138,46,255,1)" :
                        "rgba(255,255,255,1)";

    this.floaters.push({
      x, y,
      vy: -rand(18, 30),
      a: 0,
      t: 0,
      dur: rand(0.55, 0.75),
      msg,
      col
    });

    if(this.floaters.length > 70) this.floaters.splice(0, this.floaters.length-70);
  }

  // Draw inside world space (scaled already)
  drawWorld(ctx, camX, camY){
    // sparks
    for(const p of this.sparks){
      const sx = (p.x - camX)|0;
      const sy = (p.y - camY)|0;

      ctx.fillStyle = `${p.col}${p.a})`;
      ctx.fillRect(sx, sy, p.r|0, p.r|0);

      // little glow
      ctx.fillStyle = `${p.col}${p.a*0.20})`;
      ctx.fillRect(sx-2, sy-2, 4, 4);
    }

    // floaters (shadowed pixel text)
    ctx.textAlign = "center";
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    for(const f of this.floaters){
      const sx = (f.x - camX)|0;
      const sy = (f.y - camY)|0;

      const a = f.a;
      if(a <= 0.01) continue;

      ctx.fillStyle = `rgba(0,0,0,${0.50*a})`;
      ctx.fillText(f.msg, sx+1, sy+1);

      // alpha baked into color via globalAlpha
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.col;
      ctx.fillText(f.msg, sx, sy);
      ctx.restore();
    }
  }

  // Draw overlay in screen-space (scaled already, w/h in base pixels)
  drawOverlay(ctx, w, h){
    // vignette
    const v = this.vignette;
    if(v > 0){
      // cheap 4-edge vignette
      ctx.fillStyle = `rgba(0,0,0,${0.20 + v*0.40})`;
      ctx.fillRect(0,0,w,6);
      ctx.fillRect(0,h-6,w,6);
      ctx.fillRect(0,0,6,h);
      ctx.fillRect(w-6,0,6,h);
    }

    // damage pulse
    if(this.damagePulse > 0.01){
      ctx.fillStyle = `rgba(255,74,122,${this.damagePulse*0.32})`;
      ctx.fillRect(0,0,w,h);
    }

    // good pulse
    if(this.goodPulse > 0.01){
      ctx.fillStyle = `rgba(125,255,177,${this.goodPulse*0.18})`;
      ctx.fillRect(0,0,w,h);
    }

    // hit flash
    if(this.flash > 0.01){
      ctx.fillStyle = `rgba(255,255,255,${this.flash*0.55})`;
      ctx.fillRect(0,0,w,h);
    }
  }
}

