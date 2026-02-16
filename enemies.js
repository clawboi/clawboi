export class EnemyManager{
  constructor(world){
    this.world = world;
    this.list = [];
    this.hitCD = 0;
  }

  spawnWave(px,py,level=1){
    const count = Math.min(8, 2 + ((level*0.6)|0));
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const d = 70 + Math.random()*90;
      const x = px + Math.cos(a)*d;
      const y = py + Math.sin(a)*d;
      this.list.push(makeEnemy(x,y,level));
    }
  }

  update(dt, player, world, effects){
    for(const e of this.list){
      if(e.hp<=0) continue;
      // simple seek
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx,dy) || 1;
      const sp = e.speed * (effects.hallucination>0.2 ? 1.12 : 1.0);
      e.vx = (dx/len)*sp;
      e.vy = (dy/len)*sp;

      const nx = e.x + e.vx*dt;
      const ny = e.y + e.vy*dt;

      // collide with blocked tiles softly
      if(!world.isBlocked(nx, e.y, 5)) e.x = nx;
      if(!world.isBlocked(e.x, ny, 5)) e.y = ny;

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.atkCD = Math.max(0, e.atkCD - dt);
    }
  }

  resolvePlayerAttack(player){
    const hb = player.getAttackHitbox();
    if(!hb) return {count:0,kills:0};

    let count=0, kills=0;
    for(const e of this.list){
      if(e.hp<=0) continue;
      const d = Math.hypot(e.x-hb.x, e.y-hb.y);
      if(d < (hb.r + e.r)){
        e.hp -= hb.dmg;
        e.hitFlash = 0.10;
        count++;
        if(e.hp<=0){ kills++; }
      }
    }
    return {count,kills};
  }

  resolveEnemyHits(player){
    let took=false;
    for(const e of this.list){
      if(e.hp<=0) continue;
      if(e.atkCD>0) continue;
      const d = Math.hypot(player.x-e.x, player.y-e.y);
      if(d < 10){
        e.atkCD = 0.65;
        player.takeDamage(e.dmg);
        took=true;
      }
    }
    return took;
  }

  draw(ctx, camX, camY, effects){
    for(const e of this.list){
      if(e.hp<=0) continue;
      const x = (e.x - camX)|0;
      const y = (e.y - camY)|0;

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x-5, y+6, 10, 3);

      // body
      const flash = e.hitFlash>0 ? 0.85 : 0.0;
      ctx.fillStyle = `rgba(20,0,30,${0.85 + flash})`;
      ctx.fillRect(x-5, y-6, 10, 10);

      // violet core
      ctx.fillStyle = `rgba(138,46,255,${0.75 + effects.hallucination*0.15})`;
      ctx.fillRect(x-2, y-3, 4, 4);

      // tiny HP bar
      const w = 10;
      const hp = Math.max(0, e.hp)/e.hpMax;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x-5, y-10, w, 2);
      ctx.fillStyle = "rgba(255,74,122,0.9)";
      ctx.fillRect(x-5, y-10, (w*hp)|0, 2);
    }
  }
}

function makeEnemy(x,y,level){
  const hpMax = 22 + level*6;
  return {
    kind: "shadow",
    x, y,
    vx:0, vy:0,
    r: 6,
    speed: 34 + level*3,
    dmg: 6 + (level*0.6)|0,
    hpMax,
    hp: hpMax,
    hitFlash: 0,
    atkCD: 0,
  };
}
