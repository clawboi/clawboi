import { clamp } from "./utils.js";

export class PlayerTest {
  constructor(){
    this.x = 160;
    this.y = 90;

    this.vx = 0;
    this.vy = 0;

    this.speed = 90;      // base
    this.accel = 18.0;    // responsiveness
    this.friction = 14.0; // stop quick

    this.dashT = 0;
    this.dashCD = 0;

    this.face = {x:1, y:0};

    this.hp = 100;
  }

  tryDash(){
    if(this.dashCD > 0) return;
    this.dashCD = 0.55;
    this.dashT = 0.10;
  }

  update(dt, input){
    // cooldowns
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.dashT  = Math.max(0, this.dashT - dt);

    const { mx, my } = input.moveVector();

    if(Math.abs(mx)+Math.abs(my) > 0.001){
      this.face.x = mx; this.face.y = my;
    }

    const dashMul = this.dashT > 0 ? 2.6 : 1.0;
    const targetVx = mx * this.speed * dashMul;
    const targetVy = my * this.speed * dashMul;

    // accelerate toward target velocity (smooth, not floaty)
    this.vx += (targetVx - this.vx) * (1 - Math.pow(0.001, dt*this.accel));
    this.vy += (targetVy - this.vy) * (1 - Math.pow(0.001, dt*this.accel));

    // friction when no input
    if(Math.abs(mx)+Math.abs(my) < 0.001){
      this.vx *= Math.pow(0.001, dt*this.friction);
      this.vy *= Math.pow(0.001, dt*this.friction);
    }

    // integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // keep inside test room (base 320x180)
    this.x = clamp(this.x, 10, 310);
    this.y = clamp(this.y, 12, 170);
  }

  draw(ctx){
    const x = this.x|0;
    const y = this.y|0;

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

