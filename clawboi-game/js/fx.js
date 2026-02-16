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

  burst(x, y, n=10, color="rgba(179,136,255,0.9)"){
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 40 + Math.random()*80;
      this.particles.push({
        x,y,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp,
        t: 0.5 + Math.random()*0.35,
        color
      });
    }
  }

  sparks(x, y, n=8){
    this.burst(x,y,n,"rgba(255,255,255,0.85)");
  }

  hitFlash(t=0.12){
    this.flashT = Math.max(this.flashT, t);
  }

  text(x, y, msg, color="rgba(255,255,255,0.8)"){
    this.texts.push({ x,y,msg,color,t:1.2 });
  }

  update(dt){
    this.flashT = Math.max(0, this.flashT - dt);

    for (const p of this.particles){
      p.t -= dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    this.particles = this.particles.filter(p=>p.t>0);

    for (const t of this.texts){
      t.t -= dt;
      t.y -= 10*dt;
    }
    this.texts = this.texts.filter(t=>t.t>0);
  }

  drawWorld(ctx, camX, camY){
    for (const p of this.particles){
      const x = (p.x - camX)|0;
      const y = (p.y - camY)|0;
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    for (const t of this.texts){
      const x = (t.x - camX)|0;
      const y = (t.y - camY)|0;
      ctx.fillStyle = t.color;
      ctx.fillText(t.msg, x, y);
    }
  }

  drawOverlay(ctx, W, H){
    if (this.flashT > 0){
      ctx.fillStyle = `rgba(179,136,255,${0.18 * (this.flashT/0.12)})`;
      ctx.fillRect(0,0,W,H);
    }
  }
}
