// player.js
// Clawboi: movement, dash, sword, hp, xp, inventory, level, animations.

window.Player = (() => {
  const p = {
    x: 16*16 + 8,
    y: 16*16 + 8,
    vx: 0, vy: 0,
    dir: {x:0, y:1}, // facing
    speed: 1.15,
    dashCD: 0,
    dashT: 0,
    atkCD: 0,
    atkT: 0,
    atkArc: 0,
    hp: 18,
    hpMax: 18,
    lvl: 1,
    xp: 0,
    xpNeed: 8,
    atk: 2,
    inv: Array(10).fill(null), // slots
    invCount: {mushroom:0, crystal:0, potion:0},
    iFrames: 0,
    dead: false,
    deathT: 0,
    glow: 1
  };

  function addXP(n){
    if(p.dead) return;
    p.xp += n;
    while(p.xp >= p.xpNeed){
      p.xp -= p.xpNeed;
      p.lvl++;
      p.xpNeed = Math.floor(p.xpNeed*1.35 + 4);
      // level ups: health/atk/speed/glow
      p.hpMax += 3;
      p.hp = p.hpMax;
      p.atk += 1;
      p.speed += 0.06;
      p.glow += 0.08;
      window.UI?.toast(`LEVEL UP → ${p.lvl}`, "You feel the violet hum inside you.");
      window.Effects?.addFlash(1.2);
      window.Effects?.addShake(5);
    }
  }

  function pickup(type){
    // add to inventory and count
    p.invCount[type] = (p.invCount[type]||0)+1;

    // place into first empty slot with icon
    const icon = type==="mushroom" ? "🍄" : type==="crystal" ? "✦" : "✚";
    for(let i=0;i<p.inv.length;i++){
      if(!p.inv[i]){
        p.inv[i] = {type, icon};
        break;
      }
    }

    window.UI?.syncInventory(p.inv);
  }

  function consume(type){
    // remove one from inventory slots
    for(let i=0;i<p.inv.length;i++){
      if(p.inv[i]?.type === type){
        p.inv[i]=null;
        break;
      }
    }
    p.invCount[type] = Math.max(0, (p.invCount[type]||0)-1);
    window.UI?.syncInventory(p.inv);

    // effects
    if(type==="potion"){
      p.hp = Math.min(p.hpMax, p.hp + 8);
      window.UI?.toast("POTION", "Warm static stitches you together.");
    }else{
      // hallucination trigger
      const dur = type==="mushroom" ? 9 : 12;
      const intensity = type==="mushroom" ? 1.0 : 1.25;
      window.Effects?.startHallucination(dur, intensity);
      window.UI?.toast("HALLUCINATION MODE", "Reality pixelates. Enemies morph.");
      addXP(2); // reward for entering mode
    }
    window.Effects?.burst(p.x,p.y,12,"rgba(138,46,255,.9)");
    window.Effects?.addFlash(0.8);
    window.Audio?.sfx.pickup();
  }

  function hurt(dmg, knockX, knockY){
    if(p.dead) return;
    if(p.iFrames > 0) return;

    p.hp -= dmg;
    p.iFrames = 0.55;
    p.vx += knockX;
    p.vy += knockY;
    window.Effects?.addFlash(0.9);
    window.Effects?.addShake(6);
    window.Effects?.burst(p.x,p.y,10,"rgba(255,74,122,.9)");
    window.Audio?.sfx.hit();

    if(p.hp <= 0){
      p.hp = 0;
      p.dead = true;
      p.deathT = 0;
      window.UI?.toast("YOU DIED", "Press R or tap RESTART.");
      window.Effects?.addShake(10);
      window.Effects?.addFlash(1.4);
    }
  }

  function update(dt, input, world){
    if(p.dead){
      p.deathT += dt;
      return;
    }

    p.iFrames = Math.max(0, p.iFrames - dt);
    p.dashCD = Math.max(0, p.dashCD - dt);
    p.atkCD  = Math.max(0, p.atkCD - dt);
    p.atkT   = Math.max(0, p.atkT - dt);
    p.dashT  = Math.max(0, p.dashT - dt);

    // consume quick keys (1-3)
    if(input.consumeMushroom){ if(p.invCount.mushroom>0) consume("mushroom"); }
    if(input.consumeCrystal){ if(p.invCount.crystal>0) consume("crystal"); }
    if(input.consumePotion){ if(p.invCount.potion>0) consume("potion"); }

    // attack
    if(input.attack && p.atkCD<=0){
      p.atkCD = 0.22;
      p.atkT  = 0.14;
      // set arc orientation by facing dir
      p.atkArc = Math.atan2(p.dir.y, p.dir.x);
      window.Effects?.addShake(2);
      window.Audio?.sfx.slash();
    }

    // dash
    if(input.dash && p.dashCD<=0){
      p.dashCD = 0.75;
      p.dashT  = 0.12;
      // burst speed
      p.vx += p.dir.x * 6.0;
      p.vy += p.dir.y * 6.0;
      window.Effects?.burst(p.x,p.y,10,"rgba(138,46,255,.75)");
      window.Effects?.addShake(4);
    }

    // movement intent
    let mx=input.mx, my=input.my;
    const mag = Math.hypot(mx,my);
    if(mag>0.01){ mx/=mag; my/=mag; }

    // update facing
    if(Math.abs(mx)+Math.abs(my) > 0.01){
      p.dir.x = mx; p.dir.y = my;
    }

    // acceleration
    const sp = p.speed * (p.dashT>0 ? 1.35 : 1.0);
    p.vx += mx * sp;
    p.vy += my * sp;

    // friction
    p.vx *= 0.78;
    p.vy *= 0.78;

    // move with collision (simple)
    moveWithCollision(world, p.vx, 0);
    moveWithCollision(world, 0, p.vy);

    // pick up items
    for(const it of world.items){
      if(!it.alive) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if(d < 10){
        it.alive=false;
        pickup(it.type);
        addXP(1);
        window.Audio?.sfx.pickup();
        window.Effects?.burst(p.x,p.y,10,"rgba(138,46,255,.85)");
      }
    }

    world.clampToWorld(p);
  }

  function moveWithCollision(world, dx, dy){
    if(dx===0 && dy===0) return;

    const nx = p.x + dx;
    const ny = p.y + dy;

    // 8px radius
    const r = 6;

    // check corners
    const collide =
      world.isSolidAt(nx-r, ny-r) ||
      world.isSolidAt(nx+r, ny-r) ||
      world.isSolidAt(nx-r, ny+r) ||
      world.isSolidAt(nx+r, ny+r);

    if(!collide){
      p.x = nx;
      p.y = ny;
    }else{
      // soften by partial move
      p.vx *= 0.35;
      p.vy *= 0.35;
    }
  }

  function swordHitbox(){
    if(p.atkT<=0) return null;
    // sword reach
    const reach = 14;
    const x = p.x + Math.cos(p.atkArc)*reach;
    const y = p.y + Math.sin(p.atkArc)*reach;
    return {x,y,r:10};
  }

  function draw(ctx, cam, t, halluAmt){
    const x = Math.floor(p.x - cam.x);
    const y = Math.floor(p.y - cam.y);

    // aura glow (grows with level)
    const glow = (0.10 + 0.04*p.glow) * (1 + halluAmt*0.6);
    ctx.save();
    ctx.globalAlpha = 0.22 + glow;
    ctx.fillStyle = "rgba(138,46,255,1)";
    ctx.fillRect(x-10, y-10, 20, 20);
    ctx.restore();

    // body sprite pixel art (simple but distinct)
    // idle animation: hair sway + violet pulse
    const bob = Math.sin(t*5)*0.6;
    const pulse = 0.6 + 0.4*Math.sin(t*3);

    // shadow
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = "#000";
    ctx.fillRect(x-5, y+5, 10, 3);
    ctx.globalAlpha = 1;

    // legs (black)
    ctx.fillStyle = "rgba(10,10,14,1)";
    ctx.fillRect(x-3, y+1, 2, 6);
    ctx.fillRect(x+1, y+1, 2, 6);

    // torso (black + violet trim)
    ctx.fillStyle = "rgba(12,12,18,1)";
    ctx.fillRect(x-4, y-6, 8, 8);

    ctx.fillStyle = `rgba(138,46,255,${0.55+0.25*pulse})`;
    ctx.fillRect(x-4, y-2, 8, 1);

    // head (pale)
    ctx.fillStyle = "rgba(235,235,240,1)";
    ctx.fillRect(x-3, y-12, 6, 6);

    // hair (blonde)
    ctx.fillStyle = "rgba(245,220,120,1)";
    ctx.fillRect(x-4, y-13 + bob, 8, 3);
    ctx.fillRect(x-3, y-10 + bob, 6, 1);

    // violet accents (glow)
    ctx.fillStyle = `rgba(138,46,255,${0.35+0.25*pulse})`;
    ctx.fillRect(x-5, y-6, 1, 8);
    ctx.fillRect(x+4, y-6, 1, 8);

    // damage flicker
    if(p.iFrames>0){
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x-5,y-14,10,16);
      ctx.globalAlpha = 1;
    }

    // sword swing visual
    const hb = swordHitbox();
    if(hb){
      const sx = Math.floor(hb.x - cam.x);
      const sy = Math.floor(hb.y - cam.y);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillRect(sx-1, sy-6, 2, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(138,46,255,.65)";
      ctx.fillRect(sx-2, sy-2, 4, 4);
    }
  }

  return { p, update, draw, hurt, addXP, swordHitbox, consume };
})();

