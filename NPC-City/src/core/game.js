export class Game {
  constructor({ canvas, ctx, input, save, ui, assets, world }){
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.save = save;
    this.ui = ui;
    this.assets = assets;
    this.world = world;

    this.state = "menu"; // menu | play
    this.lastT = 0;

    this.player = {
      role: "actor",
      x: 0, y: 0,
      w: 18, h: 18,
      vx: 0, vy: 0,
      money: 40,
      area: "",
    };

    this.camera = {
      x: 0, y: 0,
      vw: canvas.width,
      vh: canvas.height,
    };

    // UI hooks
    ui.onStart = (role) => this.startNew(role);
    ui.onContinue = () => this.continueGame();
    ui.onNew = () => this.newGameMenu();
  }

  boot(){
    const existing = this.save.load();
    this.ui.renderMenu({ hasSave: !!existing });
    requestAnimationFrame((t)=>this.loop(t));
  }

  newGameMenu(){
    // Show menu without starting
    const existing = this.save.load();
    this.ui.renderMenu({ hasSave: !!existing });
    this.state = "menu";
  }

  startNew(role){
    const spawn = this.world.getSpawn(role);
    this.player.role = role;
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.money = role === "police" ? 120 : (role === "actor" ? 60 : 30);
    this.player.area = spawn.area;

    this.state = "play";
    this.ui.hideMenu();
    this.persist();
  }

  continueGame(){
    const data = this.save.load();
    if (!data) return this.newGameMenu();
    this.player = { ...this.player, ...data.player };
    this.state = "play";
    this.ui.hideMenu();
  }

  persist(){
    this.save.write({
      v: 1,
      player: {
        role: this.player.role,
        x: this.player.x,
        y: this.player.y,
        money: this.player.money,
        area: this.player.area,
      }
    });
  }

  loop(t){
    const dt = Math.min(0.033, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    this.update(dt);
    this.render();

    this.input.endFrame();
    requestAnimationFrame((tt)=>this.loop(tt));
  }

  update(dt){
    if (this.state !== "play") return;

    // Reset spawn quick dev key
    if (this.input.pressed("r")){
      const sp = this.world.getSpawn(this.player.role);
      this.player.x = sp.x;
      this.player.y = sp.y;
      this.player.area = sp.area;
      this.persist();
    }

    // Movement
    const a = this.input.axis();
    const run = this.input.down("shift");
    const speed = run ? 220 : 150;

    // normalize diagonal
    let ax = a.x, ay = a.y;
    const mag = Math.hypot(ax, ay);
    if (mag > 0){
      ax /= mag; ay /= mag;
    }

    const dx = ax * speed * dt;
    const dy = ay * speed * dt;

    // Collide per-axis for smooth sliding
    this.moveWithCollision(dx, 0);
    this.moveWithCollision(0, dy);

    // Clamp to world bounds
    this.player.x = clamp(this.player.x, 0, this.world.w - this.player.w);
    this.player.y = clamp(this.player.y, 0, this.world.h - this.player.h);

    // Camera follow
    const targetX = this.player.x + this.player.w/2 - this.camera.vw/2;
    const targetY = this.player.y + this.player.h/2 - this.camera.vh/2;
    this.camera.x = lerp(this.camera.x, clamp(targetX, 0, this.world.w - this.camera.vw), 0.12);
    this.camera.y = lerp(this.camera.y, clamp(targetY, 0, this.world.h - this.camera.vh), 0.12);

    // Determine area name (simple rule: based on spawn zones + rough regions)
    this.player.area = this.getAreaName(this.player.x, this.player.y, this.player.role);

    // HUD
    this.ui.setHUD({
      role: this.player.role,
      area: this.player.area,
      money: this.player.money
    });

    // Autosave (light)
    this._saveTimer = (this._saveTimer || 0) + dt;
    if (this._saveTimer > 1.5){
      this._saveTimer = 0;
      this.persist();
    }
  }

  moveWithCollision(dx, dy){
    if (!dx && !dy) return;
    const next = {
      x: this.player.x + dx,
      y: this.player.y + dy,
      w: this.player.w,
      h: this.player.h
    };
    if (!this.world.hitsSolid(next)){
      this.player.x = next.x;
      this.player.y = next.y;
      return;
    }
    // If collision, try smaller step to avoid “sticky” feel
    const steps = 6;
    for (let i=1; i<=steps; i++){
      const sx = dx * (i/steps);
      const sy = dy * (i/steps);
      const test = { x: this.player.x + sx, y: this.player.y + sy, w:this.player.w, h:this.player.h };
      if (!this.world.hitsSolid(test)){
        this.player.x = test.x;
        this.player.y = test.y;
      } else {
        break;
      }
    }
  }

  getAreaName(x,y,role){
    // quick neighborhood bands for vibe
    if (y > 1080) return "South Side";
    if (x > 1850 && y > 720) return "Civic District";
    if (y < 700 && x > 980 && x < 1780) return "Studio Row";
    if (x < 900 && y < 760) return "Midtown";
    return "Crossroads";
  }

  render(){
    const ctx = this.ctx;

    // World
    this.world.draw(ctx, this.camera);

    // Player
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(this.player.x + this.player.w/2, this.player.y + this.player.h + 5, 12, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = this.player.role === "police" ? "rgba(120,200,255,.95)"
                 : this.player.role === "thug" ? "rgba(255,120,170,.95)"
                 : "rgba(180,255,180,.95)";
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    // “Accent stripe”
    ctx.fillStyle = "rgba(138,46,255,.55)";
    ctx.fillRect(this.player.x, this.player.y, this.player.w, 3);

    ctx.restore();
  }
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

