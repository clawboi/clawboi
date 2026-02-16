/* =========================================================
   ENEMIES MODULE — fast, readable, expandable
   - Enemy base + 3 enemy types:
     Shadow Demon, Skull Spirit, Void Crawler
   - AI: seek, strafe, wander, lunge
   - Combat: hitboxes, cooldowns, knockback, invuln frames
   - Health bars + hit flash
   - Spawn system (around player, safe from walls)
   - Boss framework (cinematic intro + phases + patterns)
   ========================================================= */

const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
const dist2 = (ax,ay,bx,by)=> {
  const dx=ax-bx, dy=ay-by;
  return dx*dx+dy*dy;
};
const rand = (a,b)=> a + Math.random()*(b-a);
const rint = (a,b)=> Math.floor(rand(a,b+1));
const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];

function aabb(ax,ay,aw,ah, bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

function norm(dx,dy){
  const m = Math.hypot(dx,dy) || 1;
  return {x: dx/m, y: dy/m};
}

/* =========================================================
   HITBOX HELPERS
   You can later replace with swept collisions if needed
   ========================================================= */
function swordHitbox(player){
  // requires player.dirX/dirY and player.attackRange + player.attackWidth ideally
  const px = player.x, py = player.y;
  const w = player.width, h = player.height;
  const dirX = player.dirX || 1;
  const dirY = player.dirY || 0;

  const range = player.attackRange ?? 22;
  const thickness = player.attackWidth ?? 14;

  // if horizontal, wide; if vertical, tall
  if(Math.abs(dirX) >= Math.abs(dirY)){
    const hx = px + (dirX>0 ? w : -range);
    const hy = py + (h/2 - thickness/2);
    return {x:hx, y:hy, w:range, h:thickness};
  }else{
    const hx = px + (w/2 - thickness/2);
    const hy = py + (dirY>0 ? h : -range);
    return {x:hx, y:hy, w:thickness, h:range};
  }
}

/* =========================================================
   ENEMY BASE
   ========================================================= */
class Enemy{
  constructor(x,y){
    this.x=x; this.y=y;
    this.vx=0; this.vy=0;

    this.width=14; this.height=14;

    this.maxHp=20;
    this.hp=this.maxHp;

    this.speed=26;
    this.damage=6;

    this.hitFlash=0;     // visual flash timer
    this.invuln=0;       // hit i-frames
    this.dead=false;

    this.knockX=0; this.knockY=0; // knock velocity
    this.knockTime=0;

    this.attackCd=0;
    this.attackWind=0;

    this.type="enemy";
    this.t=rand(0,999);
  }

  centerX(){ return this.x + this.width/2; }
  centerY(){ return this.y + this.height/2; }

  takeHit(amount, kx, ky){
    if(this.invuln>0 || this.dead) return false;

    this.hp -= amount;
    this.hitFlash = 0.12;
    this.invuln = 0.20;

    // knockback
    this.knockX = kx;
    this.knockY = ky;
    this.knockTime = 0.12;

    if(this.hp <= 0){
      this.dead = true;
      this.hp = 0;
    }
    return true;
  }

  // enemy damaging player (simple)
  tryHitPlayer(player, dx, dy){
    // push player slightly if your player supports it
    if(player.invuln && player.invuln>0) return false;

    if(aabb(this.x,this.y,this.width,this.height, player.x,player.y,player.width,player.height)){
      if(typeof player.takeDamage === "function"){
        const n = norm(dx,dy);
        player.takeDamage(this.damage, n.x*120, n.y*120);
      }else{
        // fallback: set some fields if you have them
        player.hp = Math.max(0, (player.hp||100) - this.damage);
      }
      return true;
    }
    return false;
  }

  // overwritten
  update(dt, world, player, fx){}
  draw(ctx, camX, camY, hallucinating=false){}
}

/* =========================================================
   ENEMY TYPE: SHADOW DEMON (aggressive, strafes, fast)
   ========================================================= */
class ShadowDemon extends Enemy{
  constructor(x,y){
    super(x,y);
    this.type="shadow";
    this.maxHp = 28; this.hp=this.maxHp;
    this.speed = 42;
    this.damage = 8;
    this.width=14; this.height=18;

    this.strafeDir = Math.random()<0.5 ? -1 : 1;
    this.swapT = rand(0.6, 1.4);
  }

  update(dt, world, player, fx){
    if(this.dead) return;

    this.t += dt;

    // timers
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);

    // knock motion override
    if(this.knockTime>0){
      this.knockTime -= dt;
      this.x += this.knockX * dt;
      this.y += this.knockY * dt;
      return;
    }

    const ex=this.centerX(), ey=this.centerY();
    const px=player.x+player.width/2, py=player.y+player.height/2;

    const dx = px-ex, dy = py-ey;
    const d = Math.hypot(dx,dy) || 1;
    const n = {x:dx/d, y:dy/d};

    // strafe flips
    this.swapT -= dt;
    if(this.swapT<=0){
      this.swapT = rand(0.7, 1.6);
      this.strafeDir *= -1;
    }

    // strafe vector (perp)
    const sx = -n.y * this.strafeDir;
    const sy =  n.x * this.strafeDir;

    // chase + strafe blend
    const chase = 0.85;
    const strafe = 0.55;
    this.vx = (n.x*chase + sx*strafe) * this.speed;
    this.vy = (n.y*chase + sy*strafe) * this.speed;

    // lunge attack when close
    if(d < 38 && this.attackCd<=0){
      this.attackCd = 0.85;
      const burst = 220;
      this.knockX = n.x*burst;
      this.knockY = n.y*burst;
      this.knockTime = 0.10;
      if(fx?.shake) fx.shake(4,0.12);
      if(fx?.spark) fx.spark(ex,ey, "violet", 10);
    }

    // move and simple wall avoidance
    this.moveAndCollide(dt, world);

    // contact damage
    this.tryHitPlayer(player, dx, dy);
  }

  moveAndCollide(dt, world){
    const nx = this.x + this.vx*dt;
    const ny = this.y + this.vy*dt;

    // X
    let tx = nx;
    if(!world.isBlockedPx(tx, this.y) && !world.isBlockedPx(tx+this.width, this.y) &&
       !world.isBlockedPx(tx, this.y+this.height) && !world.isBlockedPx(tx+this.width, this.y+this.height)){
      this.x = tx;
    }else{
      this.vx *= -0.25;
      this.strafeDir *= -1;
    }

    // Y
    let ty = ny;
    if(!world.isBlockedPx(this.x, ty) && !world.isBlockedPx(this.x+this.width, ty) &&
       !world.isBlockedPx(this.x, ty+this.height) && !world.isBlockedPx(this.x+this.width, ty+this.height)){
      this.y = ty;
    }else{
      this.vy *= -0.25;
      this.strafeDir *= -1;
    }
  }

  draw(ctx, camX, camY, hallucinating=false){
    const x = Math.floor(this.x - camX);
    const y = Math.floor(this.y - camY);

    // shadow body
    ctx.save();
    ctx.globalAlpha = 1;

    // glow aura
    const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.006 + this.t);
    ctx.globalAlpha = hallucinating ? (0.25 + 0.25*pulse) : (0.16 + 0.14*pulse);
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x-3, y-3, this.width+6, this.height+6);

    // core
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.hitFlash>0 ? "#ffffff" : "#07040a";
    ctx.fillRect(x, y, this.width, this.height);

    // eyes
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = hallucinating ? "#00ffe1" : "#8a2eff";
    ctx.fillRect(x+3, y+5, 2, 2);
    ctx.fillRect(x+9, y+5, 2, 2);
    ctx.restore();

    this.drawHp(ctx, x, y);
  }

  drawHp(ctx,x,y){
    const w = this.width;
    const pct = this.hp/this.maxHp;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y-6, w, 3);
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x, y-6, Math.max(0, w*pct), 3);
    ctx.globalAlpha = 1;
  }
}

/* =========================================================
   ENEMY TYPE: SKULL SPIRIT (floats, fires “pulse” hitbox)
   ========================================================= */
class SkullSpirit extends Enemy{
  constructor(x,y){
    super(x,y);
    this.type="skull";
    this.maxHp=22; this.hp=this.maxHp;
    this.speed=26;
    this.damage=7;
    this.width=16; this.height=16;

    this.floatPhase = rand(0,Math.PI*2);
    this.burstCd = rand(0.8, 1.8);
  }

  update(dt, world, player, fx){
    if(this.dead) return;

    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);

    const ex=this.centerX(), ey=this.centerY();
    const px=player.x+player.width/2, py=player.y+player.height/2;
    const dx=px-ex, dy=py-ey;
    const d=Math.hypot(dx,dy) || 1;
    const n={x:dx/d, y:dy/d};

    // float wobble
    this.floatPhase += dt*2.2;
    const wob = Math.sin(this.floatPhase)*0.8;

    // orbit-ish movement when close, chase when far
    let vx=0, vy=0;
    if(d > 150){
      vx = n.x*this.speed*1.15;
      vy = n.y*this.speed*1.15;
    }else{
      // orbit
      vx = (-n.y*0.85 + n.x*0.25) * this.speed;
      vy = ( n.x*0.85 + n.y*0.25) * this.speed;
    }
    this.vx = vx;
    this.vy = vy;

    // ignore most collisions (spirit), but keep it in world bounds
    this.x = clamp(this.x + this.vx*dt, 2, world.widthPx - this.width - 2);
    this.y = clamp(this.y + (this.vy*dt + wob), 2, world.heightPx - this.height - 2);

    // pulse burst (like a spooky shockwave)
    this.burstCd -= dt;
    if(this.burstCd<=0){
      this.burstCd = rand(1.0, 2.1);

      // create a radial hit attempt (cheap)
      const rad = 26;
      if(dist2(ex,ey, px,py) < rad*rad){
        if(typeof player.takeDamage === "function"){
          player.takeDamage(this.damage, n.x*160, n.y*160);
        }
        if(fx?.shake) fx.shake(3,0.10);
      }

      if(fx?.ring) fx.ring(ex,ey, rad, "violet");
      if(fx?.spark) fx.spark(ex,ey, "white", 8);
    }
  }

  draw(ctx, camX, camY, hallucinating=false){
    const x = Math.floor(this.x - camX);
    const y = Math.floor(this.y - camY);

    ctx.save();
    const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.007 + this.floatPhase);

    // aura
    ctx.globalAlpha = hallucinating ? (0.22 + 0.22*pulse) : (0.14 + 0.16*pulse);
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x-4, y-4, this.width+8, this.height+8);

    // skull
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.hitFlash>0 ? "#ffffff" : "#0c0b10";
    ctx.fillRect(x+2, y+2, 12, 12);

    // hollow eyes
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = hallucinating ? "#ff4a7a" : "#000000";
    ctx.fillRect(x+5, y+6, 2, 2);
    ctx.fillRect(x+9, y+6, 2, 2);

    // jaw line
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x+6, y+12, 4, 1);

    ctx.restore();
    this.drawHp(ctx, x, y);
  }

  drawHp(ctx,x,y){
    const w=this.width;
    const pct=this.hp/this.maxHp;
    ctx.globalAlpha=0.75;
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(x, y-6, w, 3);
    ctx.fillStyle="#8a2eff";
    ctx.fillRect(x, y-6, Math.max(0,w*pct), 3);
    ctx.globalAlpha=1;
  }
}

/* =========================================================
   ENEMY TYPE: VOID CRAWLER (ground unit, lunge + knockback)
   ========================================================= */
class VoidCrawler extends Enemy{
  constructor(x,y){
    super(x,y);
    this.type="crawler";
    this.maxHp=34; this.hp=this.maxHp;
    this.speed=20;
    this.damage=10;
    this.width=18; this.height=12;
    this.lungeCd = rand(0.9, 1.6);
  }

  update(dt, world, player, fx){
    if(this.dead) return;

    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);

    if(this.knockTime>0){
      this.knockTime -= dt;
      this.x += this.knockX*dt;
      this.y += this.knockY*dt;
      return;
    }

    const ex=this.centerX(), ey=this.centerY();
    const px=player.x+player.width/2, py=player.y+player.height/2;
    const dx=px-ex, dy=py-ey;
    const d=Math.hypot(dx,dy) || 1;
    const n={x:dx/d, y:dy/d};

    // crawl seek
    this.vx = n.x*this.speed;
    this.vy = n.y*this.speed;

    // lunge with telegraph
    this.lungeCd -= dt;
    if(this.lungeCd<=0 && d<120){
      this.lungeCd = rand(1.0, 2.2);

      // telegraph
      this.attackWind = 0.18;
      if(fx?.spark) fx.spark(ex,ey,"violet",6);
    }

    if(this.attackWind>0){
      this.attackWind -= dt;
      // when wind finishes, do lunge
      if(this.attackWind<=0){
        const burst = 260;
        this.knockX = n.x*burst;
        this.knockY = n.y*burst;
        this.knockTime = 0.11;
        if(fx?.shake) fx.shake(5,0.10);
        if(fx?.ring) fx.ring(ex,ey, 20, "violet");
      }
    }

    this.moveAndCollide(dt, world);
    this.tryHitPlayer(player, dx, dy);
  }

  moveAndCollide(dt, world){
    const nx = this.x + this.vx*dt;
    const ny = this.y + this.vy*dt;

    // X
    let tx=nx;
    if(!world.isBlockedPx(tx, this.y) && !world.isBlockedPx(tx+this.width, this.y) &&
       !world.isBlockedPx(tx, this.y+this.height) && !world.isBlockedPx(tx+this.width, this.y+this.height)){
      this.x=tx;
    }else{
      this.vx *= -0.2;
    }

    // Y
    let ty=ny;
    if(!world.isBlockedPx(this.x, ty) && !world.isBlockedPx(this.x+this.width, ty) &&
       !world.isBlockedPx(this.x, ty+this.height) && !world.isBlockedPx(this.x+this.width, ty+this.height)){
      this.y=ty;
    }else{
      this.vy *= -0.2;
    }
  }

  draw(ctx, camX, camY, hallucinating=false){
    const x = Math.floor(this.x - camX);
    const y = Math.floor(this.y - camY);

    ctx.save();
    const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.006 + this.t);

    // smear aura
    ctx.globalAlpha = hallucinating ? (0.18 + 0.22*pulse) : (0.12 + 0.14*pulse);
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x-4, y-2, this.width+8, this.height+4);

    // body
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.hitFlash>0 ? "#ffffff" : "#07040a";
    ctx.fillRect(x, y, this.width, this.height);

    // “teeth” highlight
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = hallucinating ? "#00ffe1" : "#ff4a7a";
    ctx.fillRect(x+3, y+4, 2, 1);
    ctx.fillRect(x+7, y+4, 2, 1);
    ctx.fillRect(x+11,y+4, 2, 1);
    ctx.restore();

    this.drawHp(ctx, x, y);
  }

  drawHp(ctx,x,y){
    const w=this.width;
    const pct=this.hp/this.maxHp;
    ctx.globalAlpha=0.78;
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(x, y-6, w, 3);
    ctx.fillStyle="#8a2eff";
    ctx.fillRect(x, y-6, Math.max(0,w*pct), 3);
    ctx.globalAlpha=1;
  }
}

/* =========================================================
   BOSS FRAMEWORK
   - cinematic intro hook
   - phases + patterns
   ========================================================= */
class Boss{
  constructor(name, x, y){
    this.name = name;
    this.x=x; this.y=y;
    this.width=64; this.height=64;
    this.maxHp=260; this.hp=this.maxHp;
    this.phase=1;
    this.dead=false;

    this.intro = 1.8;      // seconds of cinematic intro
    this.patternT = 0;
    this.invuln = 0;
    this.hitFlash = 0;

    this.vx=0; this.vy=0;
  }

  centerX(){ return this.x + this.width/2; }
  centerY(){ return this.y + this.height/2; }

  takeHit(amount, kx, ky){
    if(this.invuln>0 || this.dead || this.intro>0) return false;
    this.hp -= amount;
    this.hitFlash = 0.14;
    this.invuln = 0.10;
    if(this.hp<=0){ this.hp=0; this.dead=true; }
    return true;
  }

  update(dt, world, player, fx){}
  draw(ctx, camX, camY, hallucinating=false){}
}

/* =========================================================
   BOSS: THE WATCHER (giant eye)
   - phase 1: gaze beam telegraph + dash
   - phase 2: spawns skull spirits + orbit lasers
   ========================================================= */
class WatcherBoss extends Boss{
  constructor(x,y){
    super("THE WATCHER", x,y);
    this.maxHp=320; this.hp=this.maxHp;
    this.width=78; this.height=78;

    this.gazeCd = 1.2;
    this.dashCd = 2.0;
    this.orbitA = 0;
  }

  update(dt, world, player, fx){
    if(this.dead) return;

    this.intro = Math.max(0, this.intro - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if(this.intro>0){
      // float slightly
      this.orbitA += dt*1.2;
      return;
    }

    // phase changes
    if(this.phase===1 && this.hp < this.maxHp*0.55){
      this.phase=2;
      if(fx?.shake) fx.shake(10,0.22);
      if(fx?.banner) fx.banner("PHASE 2", 1.1);
    }

    const bx=this.centerX(), by=this.centerY();
    const px=player.x+player.width/2, py=player.y+player.height/2;
    const dx=px-bx, dy=py-by;
    const d=Math.hypot(dx,dy) || 1;
    const n={x:dx/d, y:dy/d};

    // orbit drift
    this.orbitA += dt*(this.phase===1?0.7:1.1);
    const ox = Math.cos(this.orbitA)*0.25;
    const oy = Math.sin(this.orbitA)*0.18;

    this.x = clamp(this.x + ox*80*dt, 10, world.widthPx-this.width-10);
    this.y = clamp(this.y + oy*80*dt, 10, world.heightPx-this.height-10);

    // gaze beam telegraph
    this.gazeCd -= dt;
    if(this.gazeCd<=0){
      this.gazeCd = (this.phase===1) ? rand(1.1,1.6) : rand(0.9,1.3);
      if(fx?.beamTelegraph) fx.beamTelegraph(bx,by, px,py, 0.45);
      if(fx?.shake) fx.shake(6,0.10);

      // beam hit check (simple line thickness using aabb approximations)
      if(typeof fx?.beamHitPlayer === "function"){
        fx.beamHitPlayer(player, bx,by, px,py, 10, 12);
      }
    }

    // dash attack
    this.dashCd -= dt;
    if(this.dashCd<=0 && d<260){
      this.dashCd = (this.phase===1) ? rand(1.7,2.4) : rand(1.2,1.9);
      const burst = 380;
      this.x += n.x*burst*dt;
      this.y += n.y*burst*dt;
      if(fx?.ring) fx.ring(bx,by, 34, "violet");
      if(fx?.shake) fx.shake(8,0.12);

      // collide-damage
      if(aabb(this.x,this.y,this.width,this.height, player.x,player.y,player.width,player.height)){
        if(typeof player.takeDamage === "function"){
          player.takeDamage(14, n.x*260, n.y*260);
        }
      }
    }

    // phase 2 adds minions
    if(this.phase===2){
      this.patternT += dt;
      if(this.patternT > 2.4){
        this.patternT = 0;
        if(typeof fx?.spawnMinion === "function"){
          fx.spawnMinion("skull", this.x+this.width/2+rand(-80,80), this.y+this.height/2+rand(-80,80));
        }
      }
    }
  }

  draw(ctx, camX, camY, hallucinating=false){
    const x=Math.floor(this.x-camX);
    const y=Math.floor(this.y-camY);

    ctx.save();

    // aura
    const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.004);
    ctx.globalAlpha = 0.18 + 0.12*pulse;
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x-8,y-8,this.width+16,this.height+16);

    // body
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.hitFlash>0 ? "#ffffff" : "#07040a";
    ctx.fillRect(x,y,this.width,this.height);

    // eye (big)
    ctx.fillStyle = "#0f0b14";
    ctx.fillRect(x+12,y+18,this.width-24,this.height-36);

    // pupil glow
    ctx.globalAlpha = hallucinating ? 0.95 : 0.85;
    ctx.fillStyle = "#8a2eff";
    const px = x + this.width/2 + Math.sin(performance.now()*0.002)*4;
    const py = y + this.height/2 + Math.cos(performance.now()*0.002)*4;
    ctx.fillRect(Math.floor(px-4), Math.floor(py-4), 8, 8);

    // intro text hint
    if(this.intro>0){
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px ui-monospace, Menlo, monospace";
      ctx.fillText("THE WATCHER AWAKENS", x+8, y-10);
    }

    ctx.restore();
    this.drawBossHp(ctx, x, y);
  }

  drawBossHp(ctx){
    // draw at top of screen? leave to UI.js ideally.
    // Here’s minimal fallback (world-relative not screen-locked).
  }
}

/* =========================================================
   ENEMY MANAGER
   ========================================================= */
export class EnemyManager{
  constructor(){
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0;

    // tuning
    this.maxAlive = 18;
    this.spawnEvery = 1.0;

    // xp
    this.xpPer = {
      shadow: 18,
      skull:  16,
      crawler: 22
    };
  }

  clear(){
    this.enemies.length = 0;
    this.boss = null;
  }

  spawn(type, x, y){
    let e=null;
    if(type==="shadow") e = new ShadowDemon(x,y);
    else if(type==="skull") e = new SkullSpirit(x,y);
    else if(type==="crawler") e = new VoidCrawler(x,y);
    else e = new ShadowDemon(x,y);
    this.enemies.push(e);
    return e;
  }

  spawnNearPlayer(world, player){
    // try a few times to find a non-blocked point off-screen-ish
    for(let i=0;i<28;i++){
      const ang = rand(0, Math.PI*2);
      const rad = rand(140, 260);
      const x = player.x + Math.cos(ang)*rad;
      const y = player.y + Math.sin(ang)*rad;

      if(x<20 || y<20 || x>world.widthPx-20 || y>world.heightPx-20) continue;
      if(world.isBlockedPx(x,y) || world.isBlockedPx(x+10,y+10)) continue;

      const type = pick(["shadow","skull","crawler","shadow","crawler"]);
      this.spawn(type, x, y);
      return true;
    }
    return false;
  }

  startBoss(name, x, y){
    if(name==="watcher"){
      this.boss = new WatcherBoss(x,y);
    }
    return this.boss;
  }

  update(dt, world, player, fx){
    // fx can be your effects system (shake, rings, sparks, etc.)
    // boss hook for minion spawn:
    if(fx){
      fx.spawnMinion = (type, x, y)=>{
        const t = (type==="skull") ? "skull" : "shadow";
        this.spawn(t, x, y);
      };
    }

    // spawning logic (only if no boss)
    if(!this.boss){
      this.spawnTimer -= dt;
      if(this.spawnTimer<=0){
        this.spawnTimer = this.spawnEvery;
        if(this.enemies.length < this.maxAlive){
          this.spawnNearPlayer(world, player);
        }
      }
    }

    // update enemies
    for(const e of this.enemies){
      e.update(dt, world, player, fx);
    }

    // boss update
    if(this.boss){
      this.boss.update(dt, world, player, fx);
      if(this.boss.dead){
        // reward
        if(typeof player.addXP === "function") player.addXP(250);
        this.boss = null;
      }
    }

    // cleanup dead + XP
    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i];
      if(!e.dead) continue;

      // xp reward
      const xp = this.xpPer[e.type] ?? 14;
      if(typeof player.addXP === "function") player.addXP(xp);

      // death burst
      if(fx?.spark){
        fx.spark(e.centerX(), e.centerY(), "violet", 14);
      }
      this.enemies.splice(i,1);
    }
  }

  // Player sword hits enemies
  applyPlayerAttack(player, fx){
    if(!player.isAttacking) return 0;

    const hb = swordHitbox(player);
    let hits=0;

    for(const e of this.enemies){
      if(e.dead) continue;
      if(aabb(hb.x,hb.y,hb.w,hb.h, e.x,e.y,e.width,e.height)){
        const ex=e.centerX(), ey=e.centerY();
        const px=player.x+player.width/2, py=player.y+player.height/2;
        const n = norm(ex-px, ey-py);
        const dmg = player.attackPower ?? 10;

        if(e.takeHit(dmg, n.x*220, n.y*220)){
          hits++;
          if(fx?.hitFlash) fx.hitFlash(ex, ey);
          if(fx?.shake) fx.shake(2,0.08);
        }
      }
    }

    // boss too
    if(this.boss && !this.boss.dead){
      const b=this.boss;
      if(aabb(hb.x,hb.y,hb.w,hb.h, b.x,b.y,b.width,b.height)){
        const bx=b.centerX(), by=b.centerY();
        const px=player.x+player.width/2, py=player.y+player.height/2;
        const n = norm(bx-px, by-py);
        const dmg = (player.attackPower ?? 10) * 0.8;

        if(b.takeHit(dmg, n.x*180, n.y*180)){
          hits++;
          if(fx?.shake) fx.shake(4,0.10);
          if(fx?.hitFlash) fx.hitFlash(bx, by);
        }
      }
    }

    return hits;
  }

  draw(ctx, camX, camY, hallucinating=false){
    // draw enemies
    for(const e of this.enemies){
      e.draw(ctx, camX, camY, hallucinating);
    }
    // draw boss last (big)
    if(this.boss){
      this.boss.draw(ctx, camX, camY, hallucinating);
    }
  }
}
