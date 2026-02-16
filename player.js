export class Player{
  constructor({x=0,y=0}={}){
    this.x=x; this.y=y;
    this.vx=0; this.vy=0;

    this.baseSpeed = 78;
    this.speed = this.baseSpeed;

    this.hpMax = 100;
    this.hp = this.hpMax;

    this.level = 1;
    this.xp = 0;
    this.xpNext = 20;

    this.dir = {x:1,y:0};

    // attack
    this.attackCD = 0;
    this.attackWind = 0;
    this.attackArc = 0; // visual
    this.attackRange = 18;
    this.attackDamage = 12;

    // dash
    this.dashCD = 0;
    this.dashT = 0;

    // tiny idle pulse
    this.idleT = 0;

    this.move = {mx:0,my:0};
  }

  setMove(mx,my){ this.move.mx=mx; this.move.my=my; }

  tryAttack(){
    if(this.attackCD>0) return;
    this.attackCD = 0.22;
    this.attackWind = 0.10;
    this.attackArc = 0.18;
  }

  tryDash(){
    if(this.dashCD>0) return;
    this.dashCD = 0.55;
    this.dashT = 0.10;
  }

  addXP(n){
    this.xp += n;
    while(this.xp >= this.xpNext){
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(this.xpNext * 1.22 + 8);
      this.hpMax = Math.floor(this.hpMax + 12);
      this.hp = Math.min(this.hpMax, this.hp + 24);
      this.attackDamage += 2;
      this.baseSpeed += 2;
    }
  }

  takeDamage(n){
    this.hp = Math.max(0, this.hp - n);
  }

  update(dt, world, effects){
    this.idleT += dt;

    // cooldowns
    this.attackCD = Math.max(0, this.attackCD - dt);
    this.attackWind = Math.max(0, this.attackWind - dt);
    this.attackArc = Math.max(0, this.attackArc - dt);
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.dashT = Math.max(0, this.dashT - dt);

    // direction
    if(Math.abs(this.move.mx)+Math.abs(this.move.my) > 0.001){
      this.dir.x = this.move.mx;
      this.dir.y = this.move.my;
    }

    // speed (dash boosts)
    this.speed = this.baseSpeed * (this.dashT>0 ? 2.4 : 1.0);

    this.vx = this.move.mx * this.speed;
    this.vy = this.move.my * this.speed;

    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // simple world collision
    const r = 6;
    if(!world.isBlocked(nx, this.y, r)) this.x = nx;
    if(!world.isBlocked(this.x, ny, r)) this.y = ny;

    // subtle violet aura pulse during hallucination
    if(effects.hallucination > 0.1){
      // nothing needed here yet, but kept for hooks
    }
  }

  getAttackHitbox(){
    // only active while arc > 0
    if(this.attackArc <= 0) return null;
    const ax = this.x + this.dir.x * (this.attackRange);
    const ay = this.y + this.dir.y * (this.attackRange);
    return { x: ax, y: ay, r: 12, dmg: this.attackDamage };
  }

  draw(ctx, camX, camY, effects){
    const x = (this.x - camX) | 0;
    const y = (this.y - camY) | 0;

    // aura
    const pulse = 0.5 + 0.5*Math.sin(this.idleT*3.2);
    const aura = (effects.hallucination>0 ? 0.55 : 0.25) + pulse*0.08;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x-6, y+6, 12, 4);

    // aura glow ring
    ctx.fillStyle = `rgba(138,46,255,${aura})`;
    ctx.fillRect(x-8, y-10, 16, 20);

    // body (pixel “sprite”)
    // hair (blonde)
    ctx.fillStyle = "#f2d37a";
    ctx.fillRect(x-4, y-10, 8, 4);

    // face (pale)
    ctx.fillStyle = "#f3e9e6";
    ctx.fillRect(x-4, y-6, 8, 6);

    // outfit (black)
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(x-5, y, 10, 10);

    // violet accents
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.fillRect(x-5, y+5, 10, 2);

    // sword slash visual
    if(this.attackArc > 0){
      const hx = x + (this.dir.x*12)|0;
      const hy = y + (this.dir.y*12)|0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(hx-1, hy-6, 2, 12);
      ctx.fillStyle = "rgba(138,46,255,0.85)";
      ctx.fillRect(hx-3, hy-4, 1, 8);
      ctx.fillRect(hx+2, hy-4, 1, 8);
    }
  }
}
