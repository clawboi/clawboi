/* =========================================================
   UI SYSTEM — CLAWBOI RPG
   - HUD: Health, XP, Level
   - Inventory Slots
   - Hallucination Meter + Status
   - Boss Banner + Boss HP
   - Floating Numbers (damage/XP)
   - Toasts (pickups, level up, etc.)
   ========================================================= */

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

function lerp(a,b,t){ return a + (b-a)*t; }
function easeOut(t){ return 1 - Math.pow(1-t, 2); }

/* Pixel font fallback: render crisp blocks even without a font file */
function setPixelText(ctx){
  ctx.textBaseline = "top";
  ctx.imageSmoothingEnabled = false;
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
}

/* =========================================================
   UI MANAGER
   ========================================================= */
export class UIManager{
  constructor(){
    this.toasts = [];
    this.floaters = [];
    this.banner = null;      // boss intro / cinematic text
    this.bannerT = 0;

    // smooth HUD lerps
    this.hpSmooth = 1;
    this.xpSmooth = 0;
    this.halluSmooth = 0;

    // small screen shake for UI only (boss intro)
    this.uiShake = 0;
    this.uiShakeX = 0;
    this.uiShakeY = 0;

    // debug toggles
    this.showHelpHint = true;

    // colors (keep consistent with your palette)
    this.COL = {
      bg: "rgba(0,0,0,0.55)",
      panel: "rgba(0,0,0,0.62)",
      border: "rgba(255,255,255,0.12)",
      white: "rgba(255,255,255,0.92)",
      dim: "rgba(255,255,255,0.60)",
      violet: "rgba(138,46,255,0.95)",
      violetSoft: "rgba(138,46,255,0.35)",
      hot: "rgba(255,46,209,0.90)",
      good: "rgba(125,255,177,0.90)",
      danger: "rgba(255,74,122,0.90)"
    };
  }

  /* ---------------------------
     TOASTS (top-left)
     --------------------------- */
  toast(text, kind="info", ms=1400){
    this.toasts.push({
      text,
      kind,
      t: 0,
      life: ms/1000
    });
    // keep tidy
    if(this.toasts.length > 6) this.toasts.shift();
  }

  /* ---------------------------
     FLOATING NUMBERS
     - x,y are world coords (pass cam later)
     --------------------------- */
  floatText(x,y,text, kind="hit"){
    this.floaters.push({
      x,y,
      text: String(text),
      kind,
      t: 0,
      life: 0.75,
      vy: -18,
      vx: (Math.random()*10-5)
    });
    if(this.floaters.length > 120) this.floaters.splice(0, 20);
  }

  /* ---------------------------
     BOSS INTRO BANNER
     --------------------------- */
  bossIntro(title, subtitle=""){
    this.banner = { title, subtitle };
    this.bannerT = 0;
    this.uiShake = Math.max(this.uiShake, 0.9);
  }

  /* =========================================================
     UPDATE
     ========================================================= */
  update(dt, player, effects, enemyManager){
    // smooth bars
    const hp = player.hpMax > 0 ? (player.hp / player.hpMax) : 0;
    this.hpSmooth = lerp(this.hpSmooth, hp, clamp(dt*8, 0, 1));

    const xp = player.xpToNext > 0 ? (player.xp / player.xpToNext) : 0;
    this.xpSmooth = lerp(this.xpSmooth, xp, clamp(dt*6, 0, 1));

    const hallu = clamp(effects?.hallucination || 0, 0, 1);
    this.halluSmooth = lerp(this.halluSmooth, hallu, clamp(dt*6, 0, 1));

    // toasts
    for(const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t=>t.t < t.life);

    // floaters
    for(const f of this.floaters){
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy -= 18 * dt; // lift a bit more over time
    }
    this.floaters = this.floaters.filter(f=>f.t < f.life);

    // banner
    if(this.banner){
      this.bannerT += dt;
      if(this.bannerT > 3.0){
        this.banner = null;
      }
    }

    // ui shake decay
    this.uiShake = Math.max(0, this.uiShake - dt*1.4);
    if(this.uiShake > 0){
      this.uiShakeX = (Math.random()*2-1) * (this.uiShake*5);
      this.uiShakeY = (Math.random()*2-1) * (this.uiShake*5);
    }else{
      this.uiShakeX = 0;
      this.uiShakeY = 0;
    }

    // contextual hint off after first level or first item
    if(player.level > 1 || (player.inventory && Object.keys(player.inventory).length > 0)){
      this.showHelpHint = false;
    }
  }

  /* =========================================================
     DRAW
     ctx is your main canvas ctx
     camX/camY used for floaters (world->screen)
     ========================================================= */
  draw(ctx, w, h, camX, camY, player, effects, enemyManager){
    ctx.save();
    ctx.translate(this.uiShakeX, this.uiShakeY);
    ctx.imageSmoothingEnabled = false;
    setPixelText(ctx);

    this.drawHUD(ctx, w, h, player, effects, enemyManager);
    this.drawToasts(ctx);
    this.drawFloaters(ctx, camX, camY);
    this.drawBossStuff(ctx, w, h, enemyManager);
    this.drawBanner(ctx, w, h);

    ctx.restore();
  }

  /* =========================================================
     HUD BLOCK
     ========================================================= */
  drawHUD(ctx, w, h, player, effects, enemyManager){
    const pad = 12;
    const barW = Math.min(260, w * 0.46);
    const barH = 10;

    // panel background
    this.panel(ctx, pad, pad, barW + 80, 62);

    // HEALTH
    this.label(ctx, pad+10, pad+10, "HP", this.COL.dim);
    this.bar(ctx, pad+40, pad+12, barW, barH, this.hpSmooth, this.COL.hot, this.COL.violetSoft);
    this.small(ctx, pad+40, pad+26, `${Math.max(0,Math.floor(player.hp))}/${player.hpMax}`, this.COL.dim);

    // XP
    this.label(ctx, pad+10, pad+38, "XP", this.COL.dim);
    this.bar(ctx, pad+40, pad+40, barW, barH, this.xpSmooth, this.COL.violet, "rgba(255,255,255,0.08)");
    this.small(ctx, pad+40, pad+54, `LV ${player.level}`, this.COL.white);

    // Hallucination meter (top-right)
    const mW = Math.min(220, w*0.32);
    const mx = w - pad - (mW + 18);
    this.panel(ctx, mx, pad, mW + 18, 38);

    this.label(ctx, mx+9, pad+10, "TRIP", this.COL.dim);
    this.bar(ctx, mx+44, pad+12, mW-40, 10, this.halluSmooth, this.COL.violet, "rgba(255,255,255,0.08)");
    const modeTxt = this.halluSmooth > 0.05 ? "HALLUCINATING" : "STABLE";
    this.small(ctx, mx+44, pad+25, modeTxt, this.halluSmooth>0.05 ? this.COL.violet : this.COL.dim);

    // Inventory bar (bottom-left)
    this.drawInventory(ctx, w, h, player);

    // tiny hint
    if(this.showHelpHint && w > 520){
      const hint = "WASD / ARROWS: MOVE   J: ATTACK   K: DASH   E: PICKUP";
      this.caption(ctx, pad, h - 26, hint, "rgba(255,255,255,0.42)");
    }
  }

  drawInventory(ctx, w, h, player){
    const pad = 12;
    const slots = 6;
    const size = 28;
    const gap = 6;
    const invW = slots*size + (slots-1)*gap + 18;

    const x = pad;
    const y = h - pad - (size + 24);

    this.panel(ctx, x, y, invW, size + 24);

    this.label(ctx, x+9, y+8, "INVENTORY", this.COL.dim);

    const inv = player.inventory || {};
    const items = [
      {key:"mushroom", label:"M"},
      {key:"crystal",  label:"C"},
      {key:"potion",   label:"P"},
      {key:"key",      label:"K"},
      {key:"relic",    label:"R"},
      {key:"coin",     label:"$"},
    ];

    for(let i=0;i<slots;i++){
      const sx = x+9 + i*(size+gap);
      const sy = y+24;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(sx, sy, size, size);

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.strokeRect(sx+0.5, sy+0.5, size-1, size-1);

      const it = items[i];
      const count = inv[it.key] || 0;

      // icon letter
      ctx.fillStyle = count>0 ? this.COL.white : "rgba(255,255,255,0.30)";
      ctx.fillText(it.label, sx+10, sy+7);

      // count
      if(count>0){
        ctx.fillStyle = this.COL.violet;
        ctx.fillText(String(count), sx+size-10, sy+size-12);
      }
    }
  }

  /* =========================================================
     BOSS BAR (top-center)
     ========================================================= */
  drawBossStuff(ctx, w, h, enemyManager){
    if(!enemyManager?.list?.length) return;
    const boss = enemyManager.list.find(e=>e.isBoss && !e.dead);
    if(!boss) return;

    const barW = Math.min(520, w*0.70);
    const x = (w - barW)/2;
    const y = 86;

    // title
    const name = boss.type ? boss.type.toUpperCase() : "BOSS";
    this.caption(ctx, x, y-16, `BOSS: ${name}`, this.COL.dim);

    // bar shell
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, barW, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x+0.5, y+0.5, barW-1, 13);

    const pct = clamp(boss.hp / boss.hpMax, 0, 1);

    // fill
    ctx.fillStyle = this.COL.hot;
    ctx.fillRect(x+1, y+1, (barW-2)*pct, 12);

    // glow strip
    ctx.fillStyle = "rgba(138,46,255,0.12)";
    ctx.fillRect(x+1, y+1, (barW-2), 3);
  }

  /* =========================================================
     BANNER (center)
     ========================================================= */
  drawBanner(ctx, w, h){
    if(!this.banner) return;

    const t = this.bannerT;
    const inT = clamp(t/0.35, 0, 1);
    const outT = t > 2.4 ? clamp((t-2.4)/0.45, 0, 1) : 0;
    const a = (easeOut(inT)) * (1 - outT);

    const bw = Math.min(640, w*0.82);
    const bh = 92;
    const x = (w-bw)/2;
    const y = (h-bh)/2 - 40;

    ctx.globalAlpha = a;

    // card
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.strokeRect(x+0.5, y+0.5, bw-1, bh-1);

    // violet top line
    ctx.fillStyle = "rgba(138,46,255,0.35)";
    ctx.fillRect(x, y, bw, 4);

    // title
    ctx.fillStyle = this.COL.white;
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(this.banner.title.toUpperCase(), x+14, y+16);

    // subtitle
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    if(this.banner.subtitle){
      ctx.fillText(this.banner.subtitle.toUpperCase(), x+14, y+40);
    }

    // hint
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.fillText("SURVIVE. DODGE. STRIKE FAST.", x+14, y+64);

    ctx.globalAlpha = 1;
  }

  /* =========================================================
     TOASTS DRAW
     ========================================================= */
  drawToasts(ctx){
    if(!this.toasts.length) return;

    const x = 12;
    let y = 86;
    const w = 260;

    for(const t of this.toasts){
      const p = clamp(t.t / 0.18, 0, 1);
      const a = (t.life - t.t) < 0.25 ? clamp((t.life - t.t)/0.25, 0, 1) : 1;
      const slide = (1 - easeOut(p))*12;

      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      ctx.fillRect(x, y + slide, w, 20);

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.strokeRect(x+0.5, y + slide + 0.5, w-1, 19);

      // left accent
      ctx.fillStyle =
        t.kind==="good" ? this.COL.good :
        t.kind==="danger" ? this.COL.danger :
        this.COL.violet;
      ctx.fillRect(x, y + slide, 3, 20);

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText(t.text.toUpperCase(), x+10, y + slide + 5);

      ctx.globalAlpha = 1;
      y += 24;
    }
  }

  /* =========================================================
     FLOATERS DRAW (world->screen)
     ========================================================= */
  drawFloaters(ctx, camX, camY){
    for(const f of this.floaters){
      const k = f.t / f.life;
      const a = 1 - k;
      const yLift = easeOut(k) * 10;

      const sx = Math.floor(f.x - camX);
      const sy = Math.floor(f.y - camY - yLift);

      ctx.globalAlpha = a;

      ctx.fillStyle =
        f.kind==="xp" ? this.COL.good :
        f.kind==="hurt" ? this.COL.danger :
        this.COL.white;

      ctx.fillText(f.text, sx, sy);

      ctx.globalAlpha = 1;
    }
  }

  /* =========================================================
     HELPERS (panels / bars / text)
     ========================================================= */
  panel(ctx,x,y,w,h){
    ctx.fillStyle = this.COL.panel;
    ctx.fillRect(x,y,w,h);

    ctx.strokeStyle = this.COL.border;
    ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);

    // subtle violet glow line
    ctx.fillStyle = "rgba(138,46,255,0.12)";
    ctx.fillRect(x,y,w,2);
  }

  bar(ctx,x,y,w,h,pct, fill, back){
    pct = clamp(pct,0,1);
    ctx.fillStyle = back;
    ctx.fillRect(x,y,w,h);

    ctx.fillStyle = fill;
    ctx.fillRect(x,y,Math.floor(w*pct),h);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  }

  label(ctx,x,y,text,color){
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  small(ctx,x,y,text,color){
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  caption(ctx,x,y,text,color){
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
