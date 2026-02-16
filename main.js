// main.js
// Boot + game loop + input + states + camera + orchestration.

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha:false });

  // offscreen buffer to keep pixel sharp + allow post fx
  const buffer = document.createElement("canvas");
  buffer.width = canvas.width;
  buffer.height = canvas.height;
  const bctx = buffer.getContext("2d", { alpha:false });

  // audio
  window.Audio = window.Effects.initAudio();

  // controls
  const keys = new Set();
  const input = {
    mx:0, my:0,
    attack:false,
    dash:false,
    consumeMushroom:false,
    consumeCrystal:false,
    consumePotion:false
  };

  // touch joystick
  const joy = document.getElementById("joy");
  const knob = document.getElementById("joyKnob");
  let joyActive=false, joyId=null, joyCx=0, joyCy=0;
  let joyDX=0, joyDY=0;

  function setKnob(dx,dy){
    const max=36;
    const d=Math.hypot(dx,dy);
    if(d>max){ dx=dx/d*max; dy=dy/d*max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyDX = dx/max;
    joyDY = dy/max;
  }

  joy.addEventListener("pointerdown",(e)=>{
    joyActive=true; joyId=e.pointerId;
    joy.setPointerCapture(e.pointerId);
    const r=joy.getBoundingClientRect();
    joyCx=r.left+r.width/2; joyCy=r.top+r.height/2;
    setKnob(e.clientX-joyCx, e.clientY-joyCy);
    window.Audio.unlock();
  });

  joy.addEventListener("pointermove",(e)=>{
    if(!joyActive || e.pointerId!==joyId) return;
    setKnob(e.clientX-joyCx, e.clientY-joyCy);
  });

  joy.addEventListener("pointerup",(e)=>{
    if(e.pointerId!==joyId) return;
    joyActive=false; joyId=null;
    setKnob(0,0);
  });

  document.getElementById("btnAttack").addEventListener("pointerdown", ()=>{ input.attack=true; window.Audio.unlock(); });
  document.getElementById("btnDash").addEventListener("pointerdown", ()=>{ input.dash=true; window.Audio.unlock(); });

  // keyboard
  addEventListener("keydown",(e)=>{ keys.add(e.key.toLowerCase()); window.Audio.unlock(); });
  addEventListener("keyup",(e)=>{ keys.delete(e.key.toLowerCase()); });

  // states
  const State = {
    START:"START",
    PLAY:"PLAY",
    BOSS_INTRO:"BOSS_INTRO",
    BOSS:"BOSS",
    DEATH:"DEATH"
  };
  let state = State.START;
  let introT = 0;

  // setup world
  window.World.gen(Math.floor(Math.random()*999999)+1);

  // spawn initial enemies
  window.Enemies.spawnWave(window.Player.p);

  // camera
  const cam = { x:0, y:0 };

  function setState(s){
    state=s;
    window.UI.setState(s);
    if(s===State.START){
      window.UI.showCenter("THE ADVENTURES OF CLAWBOI", "PRESS ENTER / TAP TO START");
    }
    if(s===State.PLAY){
      window.UI.showCenter("", "");
    }
    if(s===State.DEATH){
      window.UI.showCenter("YOU DIED", "PRESS R / TAP RESTART");
    }
  }
  setState(State.START);

  // start on tap anywhere (so mobile is easy)
  addEventListener("pointerdown", ()=>{
    if(state===State.START){
      setState(State.PLAY);
    }
  });

  function resetGame(){
    window.Enemies.clear();
    const p = window.Player.p;
    p.x = 16*16+8; p.y=16*16+8;
    p.vx=0; p.vy=0;
    p.hpMax=18; p.hp=18;
    p.lvl=1; p.xp=0; p.xpNeed=8;
    p.atk=2; p.speed=1.15;
    p.inv.fill(null);
    p.invCount={mushroom:0, crystal:0, potion:0};
    p.dead=false; p.deathT=0;
    p.iFrames=0;
    p.glow=1;

    window.World.gen(Math.floor(Math.random()*999999)+1);
    window.Enemies.spawnWave(p);
    setState(State.START);
  }

  function readInput(){
    // reset one-frame buttons
    input.attack = false;
    input.dash = false;
    input.consumeMushroom=false;
    input.consumeCrystal=false;
    input.consumePotion=false;

    // movement from keys
    let mx = 0, my = 0;
    if(keys.has("arrowleft")||keys.has("a")) mx -= 1;
    if(keys.has("arrowright")||keys.has("d")) mx += 1;
    if(keys.has("arrowup")||keys.has("w")) my -= 1;
    if(keys.has("arrowdown")||keys.has("s")) my += 1;

    // combine with joystick
    mx += joyDX;
    my += joyDY;

    input.mx = mx;
    input.my = my;

    if(keys.has(" ") || keys.has("k")) input.attack = true;
    if(keys.has("shift") || keys.has("l")) input.dash = true;

    // consume keys
    if(keys.has("1")) input.consumeMushroom=true;
    if(keys.has("2")) input.consumeCrystal=true;
    if(keys.has("3")) input.consumePotion=true;

    if(keys.has("enter") && state===State.START){
      setState(State.PLAY);
    }
    if(keys.has("r") && state===State.DEATH){
      resetGame();
    }
  }

  function update(dt){
    readInput();

    const hallu = window.Effects.state.hallu;
    const halluAmt = hallu.on ? (hallu.intensity * hallu.meter) : 0;

    // audio hallucination shading
    window.Audio.setHallucination(hallu.on, halluAmt);

    window.UI.update(dt);
    window.Effects.update(dt);
    window.World.update(dt);

    const p = window.Player.p;

    // camera follow
    cam.x = Math.floor(p.x - canvas.width/2);
    cam.y = Math.floor(p.y - canvas.height/2);

    // state machine
    if(state===State.PLAY){
      window.Player.update(dt, input, window.World);
      window.Enemies.update(dt, window.World, p, halluAmt);

      // wave spawns
      if(window.Enemies.list.length < 4 && !window.Enemies.boss){
        window.Enemies.spawnWave(p);
      }

      // boss trigger (simple): hit level 4 or walk deep enough
      const deep = (p.x > window.World.W*window.World.TILE*0.68 && p.y > window.World.H*window.World.TILE*0.62);
      if(!window.Enemies.boss && (p.lvl>=4 || deep)){
        state = State.BOSS_INTRO;
        introT = 1.8;
        window.Enemies.startBoss(p, "WATCHER");
        window.UI.showCenter("BOSS APPROACHING", "THE WATCHER ARRIVES");
        window.Effects.addShake(8);
      }

      if(p.dead){
        state = State.DEATH;
        window.UI.showCenter("YOU DIED", "PRESS R / TAP RESTART");
      }
    }

    if(state===State.BOSS_INTRO){
      window.Player.update(dt, input, window.World);
      introT -= dt;
      if(introT<=0){
        state = State.BOSS;
        window.UI.showCenter("THE WATCHER", "DON’T LOOK AWAY.");
      }
    }

    if(state===State.BOSS){
      window.Player.update(dt, input, window.World);
      window.Enemies.update(dt, window.World, p, halluAmt);

      // if boss dead return to play
      if(window.Enemies.boss && !window.Enemies.boss.alive){
        state = State.PLAY;
        window.UI.showCenter("SILENCE", "The forest exhales.");
        window.Enemies.boss = null; // (boss getter is read-only, so we just let it be null via clear if you prefer)
      }

      if(p.dead){
        state = State.DEATH;
        window.UI.showCenter("YOU DIED", "PRESS R / TAP RESTART");
      }
    }

    if(state===State.DEATH){
      // allow tap restart on mobile
      // (we keep the UI message)
    }

    window.UI.sync(p, window.Effects.state.hallu);
  }

  function draw(){
    const hallu = window.Effects.state.hallu;
    const halluAmt = hallu.on ? (hallu.intensity * hallu.meter) : 0;

    // clear buffer
    bctx.imageSmoothingEnabled = false;
    bctx.clearRect(0,0,buffer.width,buffer.height);

    // apply screen shake to camera
    const sx = window.Effects.state.shakeX|0;
    const sy = window.Effects.state.shakeY|0;

    // draw world
    window.World.draw(bctx, {x:cam.x - sx, y:cam.y - sy}, window.Effects.state.time, halluAmt);

    // draw enemies + boss
    window.Enemies.draw(bctx, {x:cam.x - sx, y:cam.y - sy}, window.Effects.state.time, halluAmt);

    // draw player
    window.Player.draw(bctx, {x:cam.x - sx, y:cam.y - sy}, window.Effects.state.time, halluAmt);

    // draw particles
    for(const p of window.Effects.state.particles){
      const x = (p.x - (cam.x - sx))|0;
      const y = (p.y - (cam.y - sy))|0;
      bctx.globalAlpha = Math.max(0, p.life/p.max);
      bctx.fillStyle = p.col;
      bctx.fillRect(x, y, 1, 1);
      bctx.globalAlpha = 1;
    }

    // final to screen
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(buffer,0,0);

    // post effects on main ctx using the current buffer
    window.Effects.post(ctx, buffer);

    // overlay state hints in-canvas (tiny)
    if(state===State.START){
      // slight glow pulse
      const a = 0.12 + 0.08*Math.sin(window.Effects.state.time*2);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(138,46,255,1)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  // mobile tap restart
  addEventListener("pointerdown", ()=>{
    if(state===State.DEATH){
      resetGame();
    }
  });

  // main loop
  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();



