import { clamp } from "./utils.js";

export class PlayerTest{
  constructor(x, y){
    this.x = x; this.y = y;
    this.r = 6;

    this.spd = 78;
    this.dashSpd = 210;
    this.dashT = 0;

    this.face = { x: 1, y: 0 };

    this.hpMax = 100;
    this.hp = this.hpMax;

    this.level = 1;
    this.xp = 0;
    this.xpNext = 30;

    this.atkCd = 0;
  }

  addXP(v){
    this.xp += v;
    while (this.xp >= this.xpNext){
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(this.xpNext * 1.22 + 12);
      this.hpMax = Math.floor(this.hpMax * 1.06 + 4);
      this.hp = this.hpMax;
    }
  }

  heal(v){ this.hp = clamp(this.hp + v, 0, this.hpMax); }
  hurt(v){ this.hp = Math.max(0, this.hp - v); }

  tryDash(){
    if (this.dashT > 0) return false;
    this.dashT = 0.12;
    return true;
  }

  tryAttack(){
    if (this.atkCd > 0) return false;
    this.atkCd = 0.10;
    return true;
  }

  update(dt, input, world){
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);

    const mv = input.move();
    let mx = mv.x, my = mv.y;

    // normalize
    const mag = Math.hypot(mx, my) || 1;
    mx /= mag; my /= mag;

    if (mx !== 0 || my !== 0){
      this.face.x = mx;
      this.face.y = my;
    }

    const spd = (this.dashT > 0) ? this.dashSpd : this.spd;
    const nx = this.x + mx * spd * dt;
    const ny = this.y + my * spd * dt;

    // collision (simple circle vs blocked)
    if (!world.isBlockedCircle(nx, this.y, this.r)) this.x = nx;
    if (!world.isBlockedCircle(this.x, ny, this.r)) this.y = ny;
  }

  draw(ctx, camX, camY){
    const x = (this.x - camX) | 0;
    const y = (this.y - camY) | 0;

    // body (pixel)
    ctx.fillStyle = "rgba(179,136,255,0.95)";
    ctx.fillRect(x-3, y-4, 6, 8);

    // face dot
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x + (this.face.x>0?2:-2), y-1, 1, 1);
  }
}

