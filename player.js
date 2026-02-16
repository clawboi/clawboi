/* =========================================================
   PLAYER MODULE — CLAWBOI (pixel RPG-ready)
   - 4-dir movement
   - dash (i-frames + trail)
   - sword attack (fast + responsive)
   - health + damage + death
   - XP + leveling (stats scale)
   - inventory slots (minimal but expandable)
   - clean hooks for EnemyManager + Effects
   ========================================================= */

const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
const lerp  = (a,b,t)=> a + (b-a)*t;

function norm(dx,dy){
  const m = Math.hypot(dx,dy) || 1;
  return {x:dx/m, y:dy/m};
}

export class Player{
  constructor(x,y){
    // position
    this.x=x; this.y=y;

    // hitbox (kept tight)
    this.width=14;
    this.height=18;

    // direction (for sword hitbox)
    this.dirX=1;
    this.dirY=0;

    // movement
    this.speedBase=62;     // px/sec
    this.speedBonus=0;
    this.vx=0; this.vy=0;

    // combat stats
    this.level=1;
    this.xp=0;
    this.xpToNext=60;

    this.maxHpBase=100;
    this.maxHp=this.maxHpBase;
    this.hp=this.maxHp;

    this.attackBase=10;
    this.attackPower=this.attackBase;

    this.attackRange=22;
    this.attackWidth=14;

    // state
    this.dead=false;
    this.respawnTimer=0;

    // damage / invuln
    this.invuln=0;
    this.hitFlash=0;
    this.knockX=0; this.knockY=0;
    this.knockTime=0;

    // attack timing
    this.isAttacking=false;
    this.attackTimer=0;
    this.attackCd=0;

    // dash
    this.dashing=false;
    this.dashTimer=0;
    this.dashCd=0;

    // dash tuning
    this.dashDuration=0.12;
    this.dashCooldown=0.42;
    this.dashSpeed=220; // additional burst

    // “feel”
    this.hitStop=0;       // tiny pause for impact
    this.t=0;

    // inventory (8 slots)
    this.inventory = new Array(8).fill(null);
    this.selectedSlot = 0;

    // hallucination XP bonus
    this.hallucinationBonus = 0; // controlled elsewhere
  }

  get speed(){
    return (this.speedBase + this.speedBonus);
  }

  get hpPct(){
    return this.maxHp>0 ? this.hp/this.maxHp : 0;
  }

  /* ===========================
     INPUT API EXPECTED
     input = {
       up,down,left,right,
       attack, dash,
       use, nextSlot, prevSlot
     }
     =========================== */
  update(dt, input, world, fx){
    if(this.dead){
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      return;
    }

    this.t += dt;

    // hit stop
    if(this.hitStop>0){
      this.hitStop = Math.max(0, this.hitStop - dt);
      return; // freeze player updates briefly (impact feel)
    }

    // timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    // knockback overrides motion
    if(this.knockTime>0){
      this.knockTime -= dt;
      this.x += this.knockX * dt;
      this.y += this.knockY * dt;
      this._clampToWorld(world);
      return;
    }

    // choose direction based on input
    let mx=0, my=0;
    if(input.left) mx -= 1;
    if(input.right) mx += 1;
    if(input.up) my -= 1;
    if(input.down) my += 1;

    if(mx!==0 || my!==0){
      const n = norm(mx,my);
      mx=n.x; my=n.y;

      // store facing for sword
      // choose dominant axis to keep 4-direction “RPG” feeling
      if(Math.abs(mx) > Math.abs(my)){
        this.dirX = mx>0 ? 1 : -1; this.dirY = 0;
      }else{
        this.dirX = 0; this.dirY = my>0 ? 1 : -1;
      }
    }

    // dash
    if(input.dash && !this.dashing && this.dashCd<=0){
      this._startDash(fx);
    }

    // attack
    if(input.attack && !this.isAttacking && this.attackCd<=0){
      this._startAttack(fx);
    }

    // inventory cycling (optional)
    if(input.nextSlot){
      this.selectedSlot = (this.selectedSlot+1) % this.inventory.length;
    }
    if(input.prevSlot){
      this.selectedSlot = (this.selectedSlot-1+this.inventory.length) % this.inventory.length;
    }

    // update attack frames
    if(this.isAttacking){
      this.attackTimer -= dt;
      if(this.attackTimer<=0){
        this.isAttacking=false;
      }
    }

    // update dash frames
    if(this.dashing){
      this.dashTimer -= dt;
      if(this.dashTimer<=0){
        this.dashing=false;
      }
    }

    // movement
    const slowWhileAttacking = this.isAttacking ? 0.78 : 1.0;
    const dashBoost = this.dashing ? this.dashSpeed : 0;

    const targetVX = mx * (this.speed*slowWhileAttacking + dashBoost);
    const targetVY = my * (this.speed*slowWhileAttacking + dashBoost);

    // snappy but smooth acceleration
    const accel = this.dashing ? 0.55 : 0.22;
    this.vx = lerp(this.vx, targetVX, accel);
    this.vy = lerp(this.vy, targetVY, accel);

    // collide against world
    this._moveAndCollide(dt, world);

    // spawn subtle trail while dashing
    if(this.dashing && fx?.trail){
      fx.trail(this.x+this.width/2, this.y+this.height/2, this.dirX, this.dirY, "violet");
    }
  }

  _startDash(fx){
    this.dashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCd = this.dashCooldown;

    // dash i-frames
    this.invuln = Math.max(this.invuln, 0.12);

    if(fx?.shake) fx.shake(3, 0.08);
    if(fx?.spark) fx.spark(this.x+this.width/2, this.y+this.height/2, "violet", 8);
    if(fx?.sfxDash) fx.sfxDash();
  }

  _startAttack(fx){
    this.isAttacking = true;
    this.attackTimer = 0.14; // active window
    this.attackCd = 0.22;    // cooldown

    if(fx?.slash){
      fx.slash(this.x+this.width/2, this.y+this.height/2, this.dirX, this.dirY);
    }
    if(fx?.sfxSlash) fx.sfxSlash();
  }

  takeDamage(amount, knockX=0, knockY=0){
    if(this.dead) return false;
    if(this.invuln>0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.50;       // classic RPG i-frames
    this.hitFlash = 0.16;
    this.hitStop = 0.04;

    this.knockX = knockX;
    this.knockY = knockY;
    this.knockTime = 0.10;

    if(this.hp<=0){
      this.dead = true;
      this.respawnTimer = 1.2;
    }
    return true;
  }

  heal(amount){
    if(this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXP(amount){
    if(this.dead) return;
    // hallucination bonus
    const bonus = 1 + (this.hallucinationBonus || 0);
    this.xp += Math.floor(amount * bonus);

    while(this.xp >= this.xpToNext){
      this.xp -= this.xpToNext;
      this._levelUp();
    }
  }

  _levelUp(){
    this.level += 1;

    // scale stats
    this.maxHp = Math.floor(this.maxHpBase + (this.level-1)*14);
    this.attackPower = Math.floor(this.attackBase + (this.level-1)*2.2);
    this.speedBonus = Math.min(28, (this.level-1)*2);

    // restore some HP on level
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp*0.35));

    // next xp curve
    this.xpToNext = Math.floor(60 + (this.level-1)*22 + Math.pow(this.level,1.15)*8);
  }

  _moveAndCollide(dt, world){
    // X move
    const nx = this.x + this.vx*dt;
    if(!this._blockedRect(world, nx, this.y, this.width, this.height)){
      this.x = nx;
    }else{
      this.vx = 0;
    }

    // Y move
    const ny = this.y + this.vy*dt;
    if(!this._blockedRect(world, this.x, ny, this.width, this.height)){
      this.y = ny;
    }else{
      this.vy = 0;
    }

    this._clampToWorld(world);
  }

  _blockedRect(world, x,y,w,h){
    // sample corners (pixel world should provide isBlockedPx)
    return (
      world.isBlockedPx(x,y) ||
      world.isBlockedPx(x+w,y) ||
      world.isBlockedPx(x,y+h) ||
      world.isBlockedPx(x+w,y+h)
    );
  }

  _clampToWorld(world){
    this.x = clamp(this.x, 2, world.widthPx - this.width - 2);
    this.y = clamp(this.y, 2, world.heightPx - this.height - 2);
  }

  // simple pixel sprite (placeholder) until you add true sprite sheet
  draw(ctx, camX, camY, hallucinating=false){
    const x = Math.floor(this.x - camX);
    const y = Math.floor(this.y - camY);

    ctx.save();

    // violet aura (scales with level)
    const glow = clamp(0.12 + this.level*0.01, 0.12, 0.28);
    const pulse = 0.55 + 0.45*Math.sin(performance.now()*0.006 + this.t);

    ctx.globalAlpha = hallucinating ? (glow + 0.10*pulse) : (glow*0.8 + 0.08*pulse);
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x-4, y-4, this.width+8, this.height+8);

    // body (black outfit)
    ctx.globalAlpha = 1;
    ctx.fillStyle = (this.hitFlash>0) ? "#ffffff" : "#07040a";
    ctx.fillRect(x, y+4, this.width, this.height-4);

    // head (pale skin)
    ctx.globalAlpha = 1;
    ctx.fillStyle = (this.hitFlash>0) ? "#ffffff" : "#e8e2ef";
    ctx.fillRect(x+3, y, 8, 6);

    // hair (blonde)
    const sway = Math.sin(performance.now()*0.006)*1;
    ctx.fillStyle = "#e7d06a";
    ctx.fillRect(x+2, y-1 + sway, 10, 3);

    // violet accents
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#8a2eff";
    ctx.fillRect(x+2, y+11, 10, 2);

    // dash outline
    if(this.dashing){
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x-1, y-1, this.width+2, this.height+2);
    }

    // invuln blink
    if(this.invuln>0){
      ctx.globalAlpha = 0.45 + 0.35*Math.sin(performance.now()*0.03);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, this.width, this.height);
    }

    ctx.restore();
  }
}
