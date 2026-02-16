/* =========================================================
   ENEMY SYSTEM — CLAWBOI RPG
   Handles:
   - spawning
   - AI movement
   - combat
   - bosses
   - hit detection
   - rendering
   ========================================================= */

const rand = (a,b)=> a + Math.random()*(b-a);
const rint = (a,b)=> Math.floor(rand(a,b+1));
const clamp = (n,a,b)=> Math.max(a,Math.min(b,n));

/* =========================================================
   BASE ENEMY CLASS
   ========================================================= */

class Enemy {
  constructor(type,x,y,level=1){
    this.type = type;
    this.x = x;
    this.y = y;
    this.level = level;

    this.radius = 8 + level*0.6;
    this.speed = 20 + level*2;

    this.hpMax = 18 + level*6;
    this.hp = this.hpMax;

    this.damage = 6 + level*1.2;

    this.vx = 0;
    this.vy = 0;

    this.hitFlash = 0;
    this.cooldown = 0;

    this.dead = false;
    this.knockX = 0;
    this.knockY = 0;

    this.isBoss = false;
  }

  update(dt,player){
    if(this.dead) return;

    this.hitFlash = Math.max(0,this.hitFlash - dt);
    this.cooldown -= dt;

    /* AI: seek player */
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx,dy) || 1;

    const nx = dx/d;
    const ny = dy/d;

    this.vx += nx * this.speed * dt;
    this.vy += ny * this.speed * dt;

    // friction
    this.vx *= 0.86;
    this.vy *= 0.86;

    // knockback
    this.vx += this.knockX;
    this.vy += this.knockY;
    this.knockX *= 0.82;
    this.knockY *= 0.82;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx,camX,camY,effects){
    if(this.dead) return;

    const x = Math.floor(this.x - camX);
    const y = Math.floor(this.y - camY);

    // hallucination distortion
    const morph = effects?.hallucination || 0;
    const r = this.radius + Math.sin(performance.now()*0.005 + this.x)*morph*6;

    ctx.fillStyle =
      this.hitFlash>0
        ? "#ffffff"
        : this.isBoss
        ? "#ff2ed1"
        : "#8a2eff";

    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();

    /* health bar */
    const w = 20;
    const hpPct = this.hp / this.hpMax;

    ctx.fillStyle="#000";
    ctx.fillRect(x-w/2,y-r-10,w,4);

    ctx.fillStyle="#ff2ed1";
    ctx.fillRect(x-w/2,y-r-10,w*hpPct,4);
  }

  damageHit(dmg,knockX,knockY){
    this.hp -= dmg;
    this.hitFlash = 0.12;
    this.knockX += knockX;
    this.knockY += knockY;

    if(this.hp <= 0){
      this.dead = true;
      return true;
    }
    return false;
  }
}

/* =========================================================
   BOSS CLASS
   ========================================================= */

class Boss extends Enemy{
  constructor(type,x,y,level){
    super(type,x,y,level);
    this.isBoss = true;
    this.hpMax *= 6;
    this.hp = this.hpMax;
    this.radius *= 2;
    this.phase = 0;
    this.attackTimer = 2;
  }

  update(dt,player){
    super.update(dt,player);

    this.attackTimer -= dt;
    if(this.attackTimer <= 0){
      this.phase++;
      this.attackTimer = 1.5;

      // burst movement
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx,dy)||1;
      this.vx += (dx/d)*220;
      this.vy += (dy/d)*220;
    }
  }
}

/* =========================================================
   MANAGER
   ========================================================= */

export class EnemyManager{
  constructor(world){
    this.world = world;
    this.list = [];
  }

  spawnRandom(x,y,level){
    const types = ["shadow","skull","crawler"];
    const t = types[Math.floor(Math.random()*types.length)];
    this.list.push(new Enemy(t,x,y,level));
  }

  spawnBoss(id,player,world){
    const x = player.x + rand(-160,160);
    const y = player.y + rand(-160,160);
    this.list.push(new Boss(id,x,y,player.level));
  }

  clearAllNonBoss(){
    this.list = this.list.filter(e=>e.isBoss);
  }

  hasBossAlive(){
    return this.list.some(e=>e.isBoss && !e.dead);
  }

  update(dt,player,effects){
    for(const e of this.list){
      e.update(dt,player,effects);
    }

    // remove dead
    this.list = this.list.filter(e=>!e.dead);
  }

  draw(ctx,camX,camY,effects){
    for(const e of this.list){
      e.draw(ctx,camX,camY,effects);
    }
  }

  /* ------------------------
     PLAYER ATTACK COLLISION
     ------------------------ */
  resolvePlayerAttack(player){
    if(!player.attackActive) return null;

    let kills = 0;
    let count = 0;

    for(const e of this.list){
      if(e.dead) continue;

      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.hypot(dx,dy);

      if(d < player.attackRadius + e.radius){
        count++;

        const nx = dx/(d||1);
        const ny = dy/(d||1);

        const died = e.damageHit(player.attackDamage, nx*3, ny*3);
        if(died) kills++;
      }
    }

    return {count,kills};
  }

  /* ------------------------
     ENEMY HITS PLAYER
     ------------------------ */
  resolveEnemyHits(player){
    if(player.invuln > 0) return false;

    for(const e of this.list){
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.hypot(dx,dy);

      if(d < e.radius + player.radius){
        player.takeDamage(e.damage);
        player.vx -= dx*0.02;
        player.vy -= dy*0.02;
        return true;
      }
    }
    return false;
  }
}
