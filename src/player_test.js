import { clamp } from "./utils.js";

export class PlayerTest {
  constructor(x=160,y=90){
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.r = 6;

    this.speed = 92;
    this.accel = 18.0;
    this.friction = 14.0;

    this.dashT = 0;
    this.dashCD = 0;

    this.face = {x:1, y:0};
  }

  tryDash(){
    if(this.dashCD > 0) return;
    this.dashCD = 0.55;
    this.dashT = 0.10;
  }

  update(dt, input, world){
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.dashT  = Math.max(0, this.dashT - dt);

    const { mx, my } = input.moveVector();

    if(Math.abs(mx)+Math.abs(my) > 0.001){
      this.face.x = mx; this.face.y = my;
    }

    const dashMul = this.dashT > 0 ? 2.6 : 1.0;
    const targetVx = mx * this.speed * dashMul;
    const targetVy = my * this.speed * dashMul;

    this.vx += (targetVx - this.vx) * (1 - Math.pow(0.001, dt*this.accel));
    this.vy += (targetVy - this.vy) * (1 - Math.pow(0.001, dt*this.accel));

    if(Math.abs(mx)+Math.abs(my) < 0.001){
      this.vx *= Math.pow(0.001, dt*this.friction);
      this.vy *= Math.pow(0.001, dt*this.friction);
    }

    // try move X then Y (slide along walls)
    const nx = this.x + this.vx * dt;
    if(!world.isBlockedCircle(nx, this.y, this.r)) this.x = nx;
    else this.vx *= 0.2;

    const ny = this.y + this.vy * dt;
    if(!world.isBlockedCircle(this.x, ny, this.r)) this.y = ny;
    else this.vy *= 0.2;

    // keep inside world bounds
    this.x = clamp(this.x, this.r, world.worldW - this.r);
    this.y = clamp(this.y, this.r, world.worldH - this.r);
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
  }
}
