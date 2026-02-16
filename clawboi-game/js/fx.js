export class FX{
  constructor(){
    this.particles = [];
    this.texts = [];
    this.flashT = 0;
  }

  reset(){
    this.particles.length = 0;
    this.texts.length = 0;
    this.flashT = 0;
  }

  hitFlash(t=0.08){ this.flashT = Math.max(this.flashT, t); }

  burst(x,y,n=10){
    for (let i=0;i<n;i++){
      this.particles.push({
        x,y,
        vx:(Math.random()*2-1)*90,
        vy:(Math.random()*2-1)*90,
        t:0.35 + Math.random()*0.25,
      });
    }
  }

  sparksHit(x,y,n=8){
    this.burst(x,y,n);
  }

  text(x,y,msg,color="rgba(255,255,255,0.75)"){
    this.texts.push({x,y,msg,color,t:0.75});
  }

  update(dt){
    this.flashT = Math.max(0, this.flashT - dt);

    for (const p of this.particles){
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 6*dt);
      p.vy *= (1 - 6*dt);
    }
    this.particles = this.particles.filter(p=>p.t>0);

    for (const tx of this.texts){
      tx.t -= dt;
      tx.y -= 10 * dt;
    }
    this.texts = this.texts.filter(t=>t.t>0);
  }

  drawWorld(ctx, camX, camY){
    // particles
    ctx.fillStyle = "rgba(179,136,255,0.85)";
    for (const p of this.particles){
      const x = (p.x - camX)|0;
      const y = (p.y - camY)|0;
      ctx.fillRect(x,y,1,1);
    }

    // floating text
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    for (const t of this.texts){
      const x = (t.x - camX)|0;
      const y = (t.y - camY)|0;
      ctx.fillStyle = t.color;
      ctx.fillText(t.msg, x, y);
    }
    ctx.textAlign = "left";
  }

  drawOverlay(ctx, W, H){
    if (this.flashT > 0){
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0,0,W,H);
    }
  }
}

