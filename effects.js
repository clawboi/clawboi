export class Effects{
  constructor(){
    this.flash = 0;
    this.damage = 0;
    this.hallucination = 0;
  }
  update(dt){
    this.flash = Math.max(0, this.flash - dt);
    this.damage = Math.max(0, this.damage - dt);
    this.hallucination = Math.max(0, this.hallucination - dt*0.18);
  }
  hitFlash(t=0.12){ this.flash = Math.max(this.flash, t); }
  damagePulse(t=0.18){ this.damage = Math.max(this.damage, t); }
  triggerHallucination(str=1.0){ this.hallucination = Math.max(this.hallucination, str); }

  drawOverlay(ctx, w, h){
    if(this.hallucination > 0.01){
      const a = 0.10 + this.hallucination*0.20;
      ctx.fillStyle = `rgba(138,46,255,${a})`;
      ctx.fillRect(0,0,w,h);

      // cheap “pixel wobble” stripes
      ctx.fillStyle = `rgba(255,255,255,${0.05 + this.hallucination*0.06})`;
      for(let y=0;y<h;y+=12){
        ctx.fillRect(0,y,w,1);
      }
    }

    if(this.flash > 0.01){
      ctx.fillStyle = `rgba(255,255,255,${this.flash*0.6})`;
      ctx.fillRect(0,0,w,h);
    }
    if(this.damage > 0.01){
      ctx.fillStyle = `rgba(255,74,122,${this.damage*0.35})`;
      ctx.fillRect(0,0,w,h);
    }
  }
}
