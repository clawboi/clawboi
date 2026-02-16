export class UI{
  constructor(){
    this.toasts = [];
    this.bannerOn = false;
    this.bannerTitle = "";
    this.bannerSub = "";
  }

  toast(text, time=1.0, kind=""){
    this.toasts.push({text, t:time, max:time, kind});
    if(this.toasts.length>3) this.toasts.shift();
  }

  banner(title, sub){
    this.bannerOn = true;
    this.bannerTitle = title;
    this.bannerSub = sub || "";
  }

  update(dt){
    for(const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter(t=>t.t>0);
  }

  floatText(x,y,text,kind){
    // stub hook for later (so calls won't crash)
    // you can expand this into a full floater system
    this.toast(text, 0.6, kind);
  }

  draw(ctx, W, H, player, effects){
    // bars
    const pad=14;
    const barW=170, barH=10;

    // HP
    const hp = player.hp / player.hpMax;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, pad, barW, barH);
    ctx.fillStyle = "rgba(255,74,122,0.95)";
    ctx.fillRect(pad, pad, (barW*hp)|0, barH);

    // XP
    const xp = player.xp / player.xpNext;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, pad+14, barW, 6);
    ctx.fillStyle = "rgba(138,46,255,0.95)";
    ctx.fillRect(pad, pad+14, (barW*xp)|0, 6);

    // Level text
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`LV ${player.level}`, pad, pad+36);

    // hallucination meter
    const hm = effects.hallucination;
    if(hm > 0.01){
      const mw=120, mh=6;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(pad, pad+44, mw, mh);
      ctx.fillStyle = "rgba(138,46,255,0.95)";
      ctx.fillRect(pad, pad+44, (mw*hm)|0, mh);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("HALLUCINATION", pad+mw+10, pad+50);
    }

    // toasts (bottom center)
    let y = H - 28;
    for(let i=this.toasts.length-1;i>=0;i--){
      const t = this.toasts[i];
      const a = Math.max(0, Math.min(1, t.t / Math.min(0.25, t.max)));
      ctx.textAlign = "center";
      ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
      const col = t.kind==="danger" ? `rgba(255,74,122,${0.90*a})`
                : t.kind==="good"   ? `rgba(125,255,177,${0.90*a})`
                : `rgba(255,255,255,${0.85*a})`;
      ctx.fillStyle = col;
      ctx.fillText(t.text, W/2, y);
      y -= 16;
    }

    // banner overlay (death)
    if(this.bannerOn){
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0,0,W,H);
      ctx.textAlign = "center";

      ctx.fillStyle = "rgba(138,46,255,0.95)";
      ctx.font = "22px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText(this.bannerTitle, W/2, H/2 - 12);

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText(this.bannerSub, W/2, H/2 + 18);
    }
  }
}
