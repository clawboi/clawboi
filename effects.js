/* =========================================================
   EFFECTS MODULE — “legendary feel” kit
   - screen shake
   - hit flash (micro explosion)
   - sparks (particles)
   - rings (shockwaves)
   - slash arc + dash trails
   - beam telegraph (boss)
   - hallucination overlay hooks (distortion-lite)
   ========================================================= */

const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
const rand  = (a,b)=> a + Math.random()*(b-a);

export class Effects{
  constructor(){
    this.shakeMag = 0;
    this.shakeT = 0;

    this.sparks = [];
    this.rings = [];
    this.flashes = [];
    this.slashes = [];
    this.trails = [];

    // boss beams
    this.beams = []; // {x1,y1,x2,y2,t,life,w}

    // hallucination overlay (optional external toggle)
    this.hallu = {
      on:false,
      t:0,
      strength:0, // 0..1
    };

    // tiny synth SFX (no audio files)
    this.audio = null;
    this.master = null;
    this.unlocked = false;

    // canvas post overlay jitter
    this.jitter = 0;
  }

  /* =======================
     AUDIO (optional)
     call effects.unlockAudio() on first user gesture in main.js
     ======================= */
  unlockAudio(){
    if(this.unlocked) return;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audio = new AC();
      this.master = this.audio.createGain();
      this.master.gain.value = 0.12;
      this.master.connect(this.audio.destination);
      this.unlocked = true;
    }catch(e){}
  }

  _blip(type="square", freq=200, dur=0.08, gain=0.18){
    if(!this.unlocked || !this.audio) return;
    const o = this.audio.createOscillator();
    const g = this.audio.createGain();
    o.type = type;
    o.frequency.value = freq;

    const t = this.audio.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);

    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t+dur+0.02);
  }

  sfxSlash(){ this._blip("triangle", rand(260,520), 0.06, 0.20); }
  sfxDash(){  this._blip("sine", rand(140,240), 0.08, 0.18); }

  /* =======================
     CORE FX
     ======================= */
  shake(mag=4, time=0.12){
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, time);
  }

  hitFlash(x,y){
    this.flashes.push({x,y,t:0,life:0.10});
  }

  spark(x,y, color="violet", count=10){
    for(let i=0;i<count;i++){
      const ang = rand(0, Math.PI*2);
      const sp = rand(40, 160);
      this.sparks.push({
        x,y,
        vx: Math.cos(ang)*sp,
        vy: Math.sin(ang)*sp,
        r: rand(1,2.2),
        t:0,
        life: rand(0.18, 0.34),
        color
      });
    }
  }

  ring(x,y, radius=20, color="violet"){
    this.rings.push({x,y,r:0, target:radius, t:0, life:0.22, color});
  }

  trail(x,y, dirX, dirY, color="violet"){
    // little ghost afterimage dot
    this.trails.push({x,y,t:0,life:0.16,color, dx:dirX, dy:dirY});
  }

  slash(x,y, dirX, dirY){
    // arc in facing direction
    const a = Math.atan2(dirY, dirX);
    this.slashes.push({
      x,y,
      a,
      t:0,
      life:0.12
    });
  }

  beamTelegraph(x1,y1,x2,y2, life=0.45){
    this.beams.push({x1,y1,x2,y2,t:0,life,w:10});
  }

  // optional helper: “does beam hit player”
  beamHitPlayer(player, x1,y1,x2,y2, thickness=10, dmg=12){
    // quick segment-to-AABB distance check (approx)
    const px = player.x + player.width/2;
    const py = player.y + player.height/2;

    const vx = x2-x1, vy = y2-y1;
    const wx = px-x1, wy = py-y1;

    const c1 = wx*vx + wy*vy;
    const c2 = vx*vx + vy*vy;
    const t = (c2>0) ? clamp(c1/c2, 0, 1) : 0;

    const cx = x1 + vx*t;
    const cy = y1 + vy*t;
    const d = Math.hypot(px-cx, py-cy);

    if(d < thickness){
      if(typeof player.takeDamage === "function"){
        player.takeDamage(dmg, (px-cx)*8, (py-cy)*8);
      }
      this.shake(6,0.12);
      this.hitFlash(px,py);
      this.spark(px,py,"white", 12);
      this._blip("square", rand(80,140), 0.10, 0.22);
      return true;
    }
    return false;
  }

  /* =======================
     HALLUCINATION HOOKS
     ======================= */
  setHallucination(on, strength=1){
    this.hallu.on = on;
    this.hallu.strength = clamp(strength, 0, 1);
    if(!on){
      this.hallu.t = 0;
    }
  }

  /* =======================
     UPDATE / DRAW
     camera returns shake offset you add in main render
     ======================= */
  update(dt){
    // shake decay
    if(this.shakeT>0){
      this.shakeT -= dt;
      if(this.shakeT<=0){
        this.shakeT = 0;
        this.shakeMag = 0;
      }else{
        this.shakeMag *= 0.92;
      }
    }

    // hallucination wobble
    if(this.hallu.on){
      this.hallu.t += dt;
      this.jitter = 0.35 * this.hallu.strength * (0.6 + 0.4*Math.sin(this.hallu.t*7));
    }else{
      this.jitter *= 0.90;
    }

    // sparks
    for(let i=this.sparks.length-1;i>=0;i--){
      const s=this.sparks[i];
      s.t += dt;
      s.x += s.vx*dt;
      s.y += s.vy*dt;
      s.vx *= 0.90;
      s.vy *= 0.90;
      if(s.t>=s.life) this.sparks.splice(i,1);
    }

    // rings
    for(let i=this.rings.length-1;i>=0;i--){
      const r=this.rings[i];
      r.t += dt;
      r.r = (r.t/r.life) * r.target;
      if(r.t>=r.life) this.rings.splice(i,1);
    }

    // flashes
    for(let i=this.flashes.length-1;i>=0;i--){
      const f=this.flashes[i];
      f.t += dt;
      if(f.t>=f.life) this.flashes.splice(i,1);
    }

    // slashes
    for(let i=this.slashes.length-1;i>=0;i--){
      const s=this.slashes[i];
      s.t += dt;
      if(s.t>=s.life) this.slashes.splice(i,1);
    }

    // trails
    for(let i=this.trails.length-1;i>=0;i--){
      const tr=this.trails[i];
      tr.t += dt;
      if(tr.t>=tr.life) this.trails.splice(i,1);
    }

    // beams
    for(let i=this.beams.length-1;i>=0;i--){
      const b=this.beams[i];
      b.t += dt;
      if(b.t>=b.life) this.beams.splice(i,1);
    }
  }

  getShakeOffset(){
    if(this.shakeT<=0) return {x:0,y:0};
    // crunchy shake
    const mag = this.shakeMag;
    return {
      x: (Math.random()*2-1) * mag,
      y: (Math.random()*2-1) * mag
    };
  }

  /* =======================================================
     DRAW
     IMPORTANT: draw these AFTER world+actors (overlay pass)
     You pass camera offsets for world coordinates
     ======================================================= */
  draw(ctx, camX, camY){
    // RINGS
    for(const r of this.rings){
      const x = Math.floor(r.x - camX);
      const y = Math.floor(r.y - camY);
      const a = 1 - (r.t/r.life);

      ctx.save();
      ctx.globalAlpha = 0.55*a;
      ctx.strokeStyle = (r.color==="white") ? "rgba(255,255,255,0.9)" : "rgba(138,46,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x,y, r.r, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // BEAMS TELEGRAPH
    for(const b of this.beams){
      const a = 1 - (b.t/b.life);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35*a;
      ctx.strokeStyle = "rgba(138,46,255,0.9)";
      ctx.lineWidth = 3 + 6*a;
      ctx.beginPath();
      ctx.moveTo(b.x1 - camX, b.y1 - camY);
      ctx.lineTo(b.x2 - camX, b.y2 - camY);
      ctx.stroke();

      ctx.globalAlpha = 0.15 + 0.20*a;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x1 - camX, b.y1 - camY);
      ctx.lineTo(b.x2 - camX, b.y2 - camY);
      ctx.stroke();
      ctx.restore();
    }

    // SLASH ARC
    for(const s of this.slashes){
      const k = s.t/s.life;
      const a = 1-k;

      ctx.save();
      ctx.translate(s.x - camX, s.y - camY);
      ctx.rotate(s.a);

      ctx.globalAlpha = 0.50*a;
      ctx.fillStyle = "rgba(138,46,255,0.95)";
      ctx.fillRect(10, -3, 22, 6);

      ctx.globalAlpha = 0.22*a;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(14, -1, 18, 2);

      ctx.restore();
    }

    // TRAILS
    for(const tr of this.trails){
      const k = tr.t/tr.life;
      const a = 1-k;
      const x = Math.floor(tr.x - camX);
      const y = Math.floor(tr.y - camY);

      ctx.save();
      ctx.globalAlpha = 0.16*a;
      ctx.fillStyle = "rgba(138,46,255,0.9)";
      ctx.fillRect(x-6, y-6, 12, 12);
      ctx.restore();
    }

    // SPARKS
    for(const s of this.sparks){
      const k = s.t/s.life;
      const a = 1-k;
      const x = Math.floor(s.x - camX);
      const y = Math.floor(s.y - camY);

      ctx.save();
      ctx.globalAlpha = 0.75*a;
      if(s.color==="white") ctx.fillStyle="rgba(255,255,255,0.95)";
      else if(s.color==="pink") ctx.fillStyle="rgba(255,74,122,0.95)";
      else ctx.fillStyle="rgba(138,46,255,0.95)";
      ctx.fillRect(x, y, s.r, s.r);
      ctx.restore();
    }

    // HIT FLASHES (tiny white pop)
    for(const f of this.flashes){
      const k=f.t/f.life;
      const a=1-k;
      const x=Math.floor(f.x - camX);
      const y=Math.floor(f.y - camY);

      ctx.save();
      ctx.globalAlpha = 0.35*a;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x-10,y-10,20,20);
      ctx.restore();
    }

    // HALLUCINATION SCREEN OVERLAY (cheap but effective)
    if(this.hallu.on){
      const t = this.hallu.t;
      const s = this.hallu.strength;

      ctx.save();
      ctx.globalAlpha = 0.10 + 0.10*s;
      ctx.fillStyle = "rgba(138,46,255,0.9)";
      // subtle banding pulse
      const bandH = 18;
      for(let y=0; y<ctx.canvas.height; y+=bandH){
        const wob = Math.sin(t*4 + y*0.08) * 0.5*s;
        ctx.globalAlpha = 0.06 + 0.06*s;
        ctx.fillRect(0 + wob*8, y, ctx.canvas.width, 2);
      }
      ctx.restore();
    }
  }
}
