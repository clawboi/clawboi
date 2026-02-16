import { clamp } from "./utils.js";

export class PlayerTest{
  constructor(x, y){
    this.x = x; this.y = y;
    this.r = 7;

    this.face = { x: 1, y: 0 };

    this.spd = 72;
    this.dashSpd = 190;
    this.dashT = 0;

    this.atkT = 0;

    this.hpMax = 100;
    this.hp = this.hpMax;

    this.level = 1;
    this.xp = 0;
    this.xpNext = 20;
  }

  addXP(v){
    this.xp += v;
    while(this.xp >= this.xpNext){
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = (this.xpNext * 1.35)|0;
      this.hp = Math.min(this.hpMax, this.hp + 15);
    }
  }

  heal(v){
    this.hp = Math.min(this.hpMax, this.hp + v);
  }

  tryDash(){
    if (this.dashT > 0) return false;
    this.dashT = 0.12;
    return true;
  }

  tryAttack(){
    if (this.atkT > 0) return false;
    this.atkT = 0.10;
    return true;
  }

  // returns an attack hitbox or null (used by GameScene)
  attack(){
    if (this.atkT <= 0) return null;
    return {
      x: this.x + this.face.x * 14,
      y: this.y + this.face.y * 14,
      r: 14,
      dmg: 14 + ((this.level|0)*2),
      kb: 220,
    };
  }

  update(dt, input, world){
    this.atkT = Math.max(0, this.atkT - dt);
    this.dashT = Math.max(0, this.dashT - dt);

    const a = input.axis();
    let vx = a.x, vy = a.y;
    if (vx || vy){
      const m = Math.hypot(vx, vy) || 1;
      vx /= m; vy /= m;
      this.face.x = vx; this.face.y = vy;
    }

    const speed = (this.dashT > 0) ? this.dashSpd : this.spd;

    const nx = this.x + vx * speed * dt;
    const ny = this.y + vy * speed * dt;

    // world collision (simple bounds + obstacles)
    const safe = world.tryMoveCircle(this.x, this.y, nx, ny, this.r);
    this.x = safe.x;
    this.y = safe.y;

    // hard clamp to world bounds
    this.x = clamp(this.x, this.r, world.worldW - this.r);
    this.y = clamp(this.y, this.r, world.worldH - this.r);
  }

  draw(ctx, camX, camY){
    const x = (this.x - camX)|0;
    const y = (this.y - camY)|0;

    // body
    ctx.fillStyle = "rgba(179,136,255,0.92)";
    ctx.beginPath();
    ctx.arc(x, y, this.r, 0, Math.PI*2);
    ctx.fill();

    // eye (face)
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect((x + this.face.x*3)|0, (y + this.face.y*3)|0, 2, 2);
  }
}
