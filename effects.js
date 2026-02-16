// effects.js
// Screen shake, hit flashes, particles, hallucination post FX, simple audio synth.
// Attached to window for plain script usage.

window.Effects = (() => {
  const state = {
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    time: 0,
    particles: [],
    trail: [],
    hallu: { on:false, t:0, dur:0, intensity:0, meter:0 }
  };

  function addShake(power=6){ state.shake = Math.max(state.shake, power); }
  function addFlash(power=1){ state.flash = Math.max(state.flash, power); }

  function spawnParticle(x,y, vx,vy, life, col){
    state.particles.push({x,y,vx,vy,life,max:life,col});
  }
  function burst(x,y, n=10, col="rgba(138,46,255,.9)"){
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      const s=0.6+Math.random()*1.8;
      spawnParticle(x,y, Math.cos(a)*s, Math.sin(a)*s, 18+Math.random()*14, col);
    }
  }

  function startHallucination(seconds=8, intensity=1){
    state.hallu.on = true;
    state.hallu.t = 0;
    state.hallu.dur = seconds;
    state.hallu.intensity = intensity;
    state.hallu.meter = 1;
  }

  function update(dt){
    state.time += dt;

    state.shake *= 0.86;
    const s = state.shake;
    state.shakeX = (Math.random()*2-1) * s;
    state.shakeY = (Math.random()*2-1) * s;

    state.flash *= 0.85;

    for(let i=state.particles.length-1;i>=0;i--){
      const p=state.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= 1;
      if(p.life<=0) state.particles.splice(i,1);
    }

    if(state.hallu.on){
      state.hallu.t += dt;
      const k = state.hallu.t / state.hallu.dur;
      state.hallu.meter = Math.max(0, 1 - k);
      if(k >= 1){
        state.hallu.on=false;
        state.hallu.intensity = 0;
      }
    }

    if(state.trail.length > 8) state.trail.shift();
  }

  function post(ctx, buffer){
    const w = buffer.width, h = buffer.height;

    if(state.hallu.on){
      state.trail.push(bufferToCanvas(buffer));
      ctx.save();
      const it = state.hallu.intensity;
      for(let i=0;i<state.trail.length;i++){
        const alpha = (i/state.trail.length) * 0.10 * it;
        ctx.globalAlpha = alpha;
        ctx.drawImage(state.trail[i], 0, 0);
      }
      ctx.restore();
    }

    ctx.save();
    if(state.hallu.on){
      const it = state.hallu.intensity * state.hallu.meter;
      const wob = Math.sin(state.time*4) * 2 * it;
      ctx.translate(wob, -wob*0.6);
      ctx.globalAlpha = 0.10 * it;
      ctx.fillStyle = "rgba(138,46,255,1)";
      ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 1;
    }

    if(state.flash > 0.05){
      ctx.globalAlpha = Math.min(0.35, state.flash*0.25);
      ctx.fillStyle="#fff";
      ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function bufferToCanvas(buffer){
    const c = document.createElement("canvas");
    c.width = buffer.width;
    c.height = buffer.height;
    c.getContext("2d").drawImage(buffer,0,0);
    return c;
  }

  // WebAudio synth (no files)
  let audio = null;
  function initAudio(){
    if(audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.10;
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type="sine";
    osc.frequency.value=62;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.18;

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      data[i] = (Math.random()*2-1) * 0.08;
    }
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type="lowpass";
    noiseFilter.frequency.value = 420;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.10;

    const halluFilter = ctx.createBiquadFilter();
    halluFilter.type="allpass";
    halluFilter.frequency.value = 520;

    osc.connect(padGain);
    padGain.connect(halluFilter);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(halluFilter);

    halluFilter.connect(master);

    osc.start();
    noise.start();

    audio = {
      ctx, master, osc, padGain, noiseFilter, noiseGain, halluFilter,
      unlocked:false,
      unlock: async ()=>{
        if(audio.unlocked) return;
        try{ await ctx.resume(); audio.unlocked=true; }catch(e){}
      },
      sfx: {
        slash: ()=>{
          const o=ctx.createOscillator();
          const g=ctx.createGain();
          o.type="triangle";
          o.frequency.setValueAtTime(520, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime+0.08);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.10);
          o.connect(g); g.connect(master);
          o.start(); o.stop(ctx.currentTime+0.12);
        },
        hit: ()=>{
          const o=ctx.createOscillator();
          const g=ctx.createGain();
          o.type="square";
          o.frequency.setValueAtTime(180, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(70, ctx.currentTime+0.10);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.20, ctx.currentTime+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12);
          o.connect(g); g.connect(master);
          o.start(); o.stop(ctx.currentTime+0.14);
        },
        pickup: ()=>{
          const o=ctx.createOscillator();
          const g=ctx.createGain();
          o.type="sine";
          o.frequency.setValueAtTime(600, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime+0.08);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.10);
          o.connect(g); g.connect(master);
          o.start(); o.stop(ctx.currentTime+0.12);
        },
        boss: ()=>{
          const o=ctx.createOscillator();
          const g=ctx.createGain();
          o.type="sawtooth";
          o.frequency.setValueAtTime(90, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(45, ctx.currentTime+0.40);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime+0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.48);
          o.connect(g); g.connect(master);
          o.start(); o.stop(ctx.currentTime+0.55);
        }
      },
      setHallucination: (on, amt)=>{
        const t=ctx.currentTime;
        audio.osc.detune.setTargetAtTime(on? 80*amt : 0, t, 0.05);
        audio.noiseFilter.frequency.setTargetAtTime(on? 220+amt*220 : 420, t, 0.08);
        audio.master.gain.setTargetAtTime(on? 0.11 : 0.10, t, 0.10);
      }
    };
    return audio;
  }

  return {
    state,
    update,
    post,
    addShake,
    addFlash,
    burst,
    startHallucination,
    initAudio
  };
})();

