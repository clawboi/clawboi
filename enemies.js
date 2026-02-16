// enemies.js
// Enemies + boss system: AI follow, attacks, hit detection, phase changes.

window.Enemies = (() => {
  const list = [];
  let boss = null;

  function spawn(x,y,type="demon"){
    const e = baseEnemy(x,y,type);
    list.push(e);
    return e;
  }

  function baseEnemy(x,y,type){
    const common = {
      x,y,vx:0,vy:0,
      hp: 6,
      hpMax: 6,
      speed: 0.55,
      dmg: 2,
      knock: 2.2,
      cd: 0,
      alive:true,
      type,
      morph: Math.random()*Math.PI*2
    };

    if(type==="skull"){
      common.hp = common.hpMax = 5;
      common.speed = 0.70;
      common.dmg = 2;
    }
    if(type==="crawler"){
      common.hp = common.hpMax = 7;
      common.speed = 0.45;
      common.dmg = 3;
    }
    return common;
  }

  function spawnWave(player){
    // spawn near player but offscreen-ish
    const n = 5 + Math.floor(player.lvl*0.5);
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      const r=110+Math.random()*140;
      const x = player.x + Math.cos(a)*r;
      const y = player.y + Math.sin(a)*r;
      const type = Math.random()<0.34 ? "skull" : Math.random()<0.50 ? "crawler" : "demon";
      spawn(x,y,type);
    }
  }

  function update(dt, world, player, halluAmt){
    // boss update if active
    if(boss?.alive){
      updateBoss(dt, player, halluAmt);
    }

    // enemies
    for(let i=list.length-1;i>=0;i--){
      const e=list[i];
      if(!e.alive){ list.splice(i,1); continue; }

      e.cd = Math.max(0, e.cd - dt);

      // enemy morph in hallucination mode
      e.morph += dt*(1 + halluAmt*2);

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx,dy) || 1;

      // pursue
      const mx = dx/d;
      const my = dy/d;

      const sp = e.speed * (1 + halluAmt*0.35);
      e.vx += mx*sp;
      e.vy += my*sp;

      // friction
      e.vx *= 0.82;
      e.vy *= 0.82;

      // move (simple collision softness)
      const nx = e.x + e.vx;
      const ny = e.y + e.vy;
      const r = 6;
      const collide =
        world.isSolidAt(nx-r, ny-r) ||
        world.isSolidAt(nx+r, ny-r) ||
        world.isSolidAt(nx-r, ny+r) ||
        world.isSolidAt(nx+r, ny+r);

      if(!collide){ e.x=nx; e.y=ny; } else { e.vx*=0.4; e.vy*=0.4; }

      // attack player if close
      if(d < 14 && e.cd<=0){
        e.cd = 0.9;
        player.hurt(e.dmg, mx*e.knock, my*e.knock);
      }
    }

    // player sword hits
    const hb = window.Player.swordHitbox();
    if(hb){
      for(const e of list){
        if(!e.alive) continue;
        const d = Math.hypot(e.x - hb.x, e.y - hb.y);
        if(d < hb.r){
          hitEnemy(e, player, hb);
        }
      }
      if(boss?.alive){
        const d = Math.hypot(boss.x - hb.x, boss.y - hb.y);
        if(d < boss.r + hb.r - 6){
          boss.hurt(player.atk);
        }
      }
    }
  }

  function hitEnemy(e, player, hb){
    e.hp -= player.atk;
    window.Effects.addFlash(0.5);
    window.Effects.addShake(3);
    window.Effects.burst(e.x,e.y,10,"rgba(138,46,255,.85)");
    window.Audio?.sfx.hit();

    // knockback
    const dx = e.x - hb.x;
    const dy = e.y - hb.y;
    const d = Math.hypot(dx,dy)||1;
    e.vx += (dx/d)*3.2;
    e.vy += (dy/d)*3.2;

    if(e.hp <= 0){
      e.alive=false;
      player.addXP(3);
      window.Effects.burst(e.x,e.y,16,"rgba(255,255,255,.22)");
    }
  }

  function draw(ctx, cam, t, halluAmt){
    // regular enemies
    for(const e of list){
      if(!e.alive) continue;
      const x = Math.floor(e.x - cam.x);
      const y = Math.floor(e.y - cam.y);

      // shadow
      ctx.globalAlpha = 0.30;
      ctx.fillStyle="#000";
      ctx.fillRect(x-5,y+5,10,3);
      ctx.globalAlpha=1;

      const morph = halluAmt>0 ? (Math.sin(e.morph*3)*2) : 0;
      const w = 10 + morph;
      const h = 10 - morph*0.6;

      // body color
      let col = "rgba(16,16,22,1)";
      let glow = "rgba(138,46,255,.18)";
      if(e.type==="skull"){ col="rgba(220,220,230,1)"; glow="rgba(138,46,255,.22)"; }
      if(e.type==="crawler"){ col="rgba(12,12,16,1)"; glow="rgba(255,74,122,.12)"; }

      // glow aura
      ctx.globalAlpha = 0.25 + halluAmt*0.12;
      ctx.fillStyle = glow;
      ctx.fillRect(x-8,y-8,16,16);
      ctx.globalAlpha = 1;

      // sprite
      ctx.fillStyle = col;
      ctx.fillRect(x - w/2, y - h/2, w, h);

      // face mark
      ctx.fillStyle="rgba(138,46,255,.65)";
      ctx.fillRect(x-1,y-1,2,2);

      // HP bar
      const k = Math.max(0, e.hp/e.hpMax);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle="rgba(255,255,255,.12)";
      ctx.fillRect(x-8,y-12,16,2);
      ctx.fillStyle="rgba(138,46,255,.85)";
      ctx.fillRect(x-8,y-12,16*k,2);
      ctx.globalAlpha = 1;
    }

    // boss
    if(boss?.alive) drawBoss(ctx, cam, t, halluAmt);
  }

  // ===== Boss System =====
  function startBoss(player, which="WATCHER"){
    boss = makeBoss(player, which);
    window.Audio?.sfx.boss();
    window.UI?.toast(`BOSS: ${boss.name}`, "The air turns into an eye.");
    return boss;
  }

  function makeBoss(player, which){
    if(which==="WATCHER"){
      const b = {
        name: "THE WATCHER",
        x: player.x + 140,
        y: player.y,
        r: 22,
        hpMax: 85,
        hp: 85,
        phase: 1,
        t: 0,
        alive: true,
        cd: 0,
        hurt: (dmg)=>{
          b.hp -= dmg;
          window.Effects.addShake(4);
          window.Effects.addFlash(0.5);
          window.Effects.burst(b.x,b.y,12,"rgba(138,46,255,.85)");
          if(b.hp <= 0){
            b.hp = 0;
            b.alive=false;
            window.UI?.toast("BOSS DEFEATED", "The eye closes forever.");
            window.Effects.addShake(10);
            window.Effects.addFlash(1.2);
            player.addXP(25);
          }else{
            if(b.hp < b.hpMax*0.55) b.phase = 2;
            if(b.hp < b.hpMax*0.25) b.phase = 3;
          }
        }
      };
      return b;
    }

    // placeholders for future
    return makeBoss(player, "WATCHER");
  }

  function updateBoss(dt, player, halluAmt){
    boss.t += dt;
    boss.cd = Math.max(0, boss.cd - dt);

    // hover chase
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const d = Math.hypot(dx,dy)||1;
    const mx = dx/d, my = dy/d;

    const sp = 0.38 + boss.phase*0.06 + halluAmt*0.08;
    boss.x += mx * sp * 10 * dt;
    boss.y += my * sp * 10 * dt;

    // patterns
    if(boss.cd<=0){
      if(boss.phase===1){
        // pulse shot (damage if close)
        boss.cd = 1.1;
        bossPulse(player, 3, 18);
      } else if(boss.phase===2){
        boss.cd = 0.9;
        bossPulse(player, 4, 24);
        if(Math.random()<0.45) bossRing(player, 2);
      } else {
        boss.cd = 0.75;
        bossPulse(player, 5, 30);
        bossRing(player, 3);
      }
    }
  }

  function bossPulse(player, dmg, knock){
    window.Effects.addShake(6);
    window.Effects.addFlash(0.6);
    window.Effects.burst(boss.x,boss.y,18,"rgba(255,255,255,.20)");
    // if player within range, hurt
    const d = Math.hypot(player.x-boss.x, player.y-boss.y);
    if(d < 42){
      const dx = (player.x-boss.x)/(d||1);
      const dy = (player.y-boss.y)/(d||1);
      player.hurt(dmg, dx*knock*0.10, dy*knock*0.10);
    }
  }

  function bossRing(player, dmg){
    // ring attack: if player near ring radius, hurt
    const d = Math.hypot(player.x-boss.x, player.y-boss.y);
    const band = Math.abs(d - 58);
    if(band < 8){
      const dx = (player.x-boss.x)/(d||1);
      const dy = (player.y-boss.y)/(d||1);
      player.hurt(dmg, dx*2.5, dy*2.5);
    }
  }

  function drawBoss(ctx, cam, t, halluAmt){
    const x = Math.floor(boss.x - cam.x);
    const y = Math.floor(boss.y - cam.y);

    // glow
    ctx.globalAlpha = 0.25 + halluAmt*0.14;
    ctx.fillStyle = "rgba(138,46,255,1)";
    ctx.fillRect(x-30,y-30,60,60);
    ctx.globalAlpha = 1;

    // body: eye
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.fillRect(x-18,y-10,36,20);
    ctx.fillStyle="rgba(0,0,0,1)";
    ctx.fillRect(x-10,y-6,20,12);

    // iris
    ctx.fillStyle="rgba(138,46,255,.95)";
    const wob = Math.sin(t*4)*3;
    ctx.fillRect(x-2+wob,y-2,4,4);

    // HP bar (boss)
    const k = Math.max(0, boss.hp/boss.hpMax);
    ctx.globalAlpha=0.85;
    ctx.fillStyle="rgba(255,255,255,.10)";
    ctx.fillRect(12, 10, ctx.canvas.width-24, 6);
    ctx.fillStyle="rgba(138,46,255,.85)";
    ctx.fillRect(12, 10, (ctx.canvas.width-24)*k, 6);
    ctx.globalAlpha=1;

    // ring telegraph
    if(boss.phase>=2){
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle="rgba(138,46,255,1)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(x,y,58,0,Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function clear(){
    list.length=0;
    boss=null;
  }

  return {
    list,
    spawn,
    spawnWave,
    update,
    draw,
    startBoss,
    get boss(){ return boss; },
    clear
  };
})();

