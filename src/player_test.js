import { clamp } from "./utils.js";

export class PlayerTest {
  constructor(x=160,y=90){
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.r = 6;

    // movement feel
    this.speed = 92;
    this.accel = 18.0;
    this.friction = 14.0;

    // combat stats
    this.hpMax = 100;
    this.hp = this.hpMax;

    this.level = 1;
    this.xp = 0;
    this.xpNext = 24;

    this.dmg = 14;
    this.attackRange = 16;

    // dash
    this.dashT = 0;
    this.dashCD = 0;

    // attack
    this.atkCD = 0;
    this.atkArc = 0; // visual window

    // knockback impulse
    this.kickT = 0;

    this.face = {x:1, y:0};
  }

  takeDamage(n){
    this.hp = Math.max(0, this.hp - n);
  }

  heal(n){
    this.hp = Math.min(this.hpMax, this.hp + n);
  }

  addXP(n){
    this.xp += n;
    while(this.xp >= this.xpNext){
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(this.xpNext*1.22 + 10);
      this.hpMax = Math.floor(this.hpMax + 12);
      this.hp = Math.min(this.hpMax, this.hp + 18);
      this.dmg += 2;
      this.speed += 2;
    }
  }

  tryDash(){
    if(this.dashCD > 0) return false;
    this.dashCD = 0.55;
    this.dashT = 0.10;
    return true;
  }

  tryAttack(){
    if(this.atkCD > 0) return false;
    this.atkCD = 0.22;
    this.atkArc = 0.14;
    return true;
  }

  // external knockback
  kick(vx, vy, t=0.10){
    this.vx += vx;
    this.vy += vy;
    this.kickT = Math.max(this.kickT, t);
  }

  update(dt, input, world){
    // cooldowns
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.dashT  = Math.max(0, this.dashT - dt);
    this.atkCD  = Math.max(0, this.atkCD - dt);
    this.atkArc = Math.max(0, this.atkArc - dt);
    this.kickT  = Math.max(0, this.kickT - dt);

    const { mx, my } = input.moveVector();

    if(Math.abs(mx)+Math.abs(my) > 0.001){
      this.face.x = mx; this.face.y = my;
    }

    const dashMul = this.dashT > 0 ? 2.6 : 1.0;
    const targetVx = mx * this.speed * dashMul;
    const targetVy = my * this.speed * dashMul;

    // if being kicked, reduce steering a bit
    const steer = this.kickT > 0 ? 0.35 : 1.0;

    this.vx += (targetVx - this.vx) * (1 - Math.pow(0.001, dt*this.accel*steer));
    this.vy += (targetVy - this.vy) * (1 - Math.pow(0.001, dt*this.accel*steer));

    if(Math.abs(mx)+Math.abs(my) < 0.001 && this.kickT<=0){
      this.vx *= Math.pow(0.001, dt*this.friction);
      this.vy *= Math.pow(0.001, dt*this.friction);
    }

    // collision slide
    const nx = this.x + this.vx * dt;
    if(!world.isBlockedCircle(nx, this.y, this.r)) this.x = nx;
    else this.vx *= 0.25;

    const ny = this.y + this.vy * dt;
    if(!world.isBlockedCircle(this.x, ny, this.r)) this.y = ny;
    else this.vy *= 0.25;

    this.x = clamp(this.x, this.r, world.worldW - this.r);
    this.y = clamp(this.y, this.r, world.worldH - this.r);
  }

  getHitbox(){
    if(this.atkArc <= 0) return null;

    const hx = this.x + this.face.x * this.attackRange;
    const hy = this.y + this.face.y * this.attackRange;

    return {
      x: hx,
      y: hy,
      r: 12,
      dmg: this.dmg,
      kb: 260 + this.level*18
    };
  }

  draw(ctx, camX, camY){
    const x = (this.x - camX) | 0;
    const y = (this.y - camY) | 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x-6, y+7, 12, 3);

    // aura
    ctx.fillStyle = "rgba(138,46,255,0.30)";
    ctx.fillRect(x-9, y-11, 18, 22);

    // hair
    ctx.fillStyle = "#f2d37a";
    ctx.fillRect(x-4, y-10, 8, 4);

    // face
    ctx.fillStyle = "#f3e9e6";
    ctx.fillRect(x-4, y-6, 8, 6);

    // body
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(x-5, y, 10, 10);

    // violet belt
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.fillRect(x-5, y+5, 10, 2);

    // facing pip
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x + (this.face.x*6)|0, y + (this.face.y*6)|0, 2, 2);

    // sword slash
    if(this.atkArc > 0){
      const sx = x + (this.face.x*12)|0;
      const sy = y + (this.face.y*12)|0;

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(sx-1, sy-6, 2, 12);

      ctx.fillStyle = "rgba(138,46,255,0.85)";
      ctx.fillRect(sx-3, sy-4, 1, 8);
      ctx.fillRect(sx+2, sy-4, 1, 8);
    }
  }
}
