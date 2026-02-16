import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { PlayerTest } from "./player_test.js";
import { WorldForest } from "./world_forest.js";
import { WorldNode } from "./world_node.js";
import { EnemyManager } from "./enemies.js";
import { DropManager } from "./drops.js";
import { PickupManager } from "./pickups.js";
import { FX } from "./fx.js";
import { Quest } from "./quest.js";
import { Interactables } from "./interactables.js";
import { WeaponSystem } from "./weapons.js";

export class GameScene{
  constructor(cam, input){
    this.cam = cam;
    this.input = input;

    this.state = "start"; // start | play | win | dead

    this.forest = null;
    this.node = null;
    this.world = null;
    this.room = "forest";

    this.player = null;
    this.enemies = null;
    this.drops = null;
    this.pickups = null;
    this.fx = null;
    this.quest = null;
    this.interact = null;

    this.inv = { key:false };
    this.waveTimer = 0;

    // safe optional
    this.weapons = new WeaponSystem({ enabled:true, defaultId:"claw" });
  }

  onEnter(){
    this.startGame();
  }

  startGame(){
    this.forest = new WorldForest();
    this.node = new WorldNode();

    this.world = this.forest;
    this.room = "forest";

    this.player = new PlayerTest(this.world.spawn.x, this.world.spawn.y);

    this.cam.setWorld(this.world.worldW, this.world.worldH);
    this.cam.x = 0; this.cam.y = 0;

    this.enemies = new EnemyManager(this.world);
    this.drops = new DropManager();
    this.pickups = new PickupManager();
    this.fx = new FX();
    this.quest = new Quest();
    this.interact = new Interactables();

    this.inv.key = false;
    this.quest.reset();
    this.fx.reset();
    this.drops.reset();
    this.pickups.reset(3);
    this.enemies.reset();
    this.interact.reset();

    // place shards
    for(let i=0;i<3;i++){
      const p = this.findOpenSpot(this.world.spawn.x, this.world.spawn.y, 120 + i*70);
      this.pickups.addShard(p.x, p.y);
    }

    // note, chest, gate, entrance near each other
    this.interact.add("note", this.world.spawn.x + 40, this.world.spawn.y + 10, {
      text:
        "THE FOREST IS A SIMULATION WITH TEETH.\n"+
        "SHARDS ARE ITS EYES.\n"+
        "THE KEY REMEMBERS WHAT YOU FORGOT."
    });

    const chest = this.findOpenSpot(this.world.spawn.x, this.world.spawn.y, 160);
    this.interact.add("chest", chest.x, chest.y, { contains:"key", opened:false });

    const gate = this.findOpenSpot(this.world.spawn.x, this.world.spawn.y, 220);
    this.interact.add("gate", gate.x, gate.y, { locked:true });
    this.interact.add("entrance", gate.x + 42, gate.y, {});

    // first wave
    this.enemies.spawnWave(this.player.x, this.player.y, 6);
    this.waveTimer = 10;

    this.state = "play";
    this.fx.text(this.player.x, this.player.y - 14, "WASD/ARROWS to move", "rgba(255,255,255,0.85)");
    this.fx.text(this.player.x, this.player.y - 28, "J/SPACE or ⚔️ to slash", "rgba(179,136,255,0.9)");
    this.fx.text(this.player.x, this.player.y - 42, "E to interact", "rgba(179,136,255,0.9)");
  }

  findOpenSpot(cx, cy, radius){
    for(let i=0;i<800;i++){
      const a = Math.random()*Math.PI*2;
      const d = radius*(0.35 + Math.random()*0.65);
      const x = cx + Math.cos(a)*d;
      const y = cy + Math.sin(a)*d;
      if (!this.world.isBlockedCircle(x,y,10)) return { x:x|0, y:y|0 };
    }
    return { x:cx|0, y:cy|0 };
  }

  enterNode(){
    this.room = "node";
    this.world = this.node;

    this.cam.setWorld(this.world.worldW, this.world.worldH);

    this.enemies = new EnemyManager(this.world);
    this.enemies.reset();
    this.enemies.spawnWave(this.world.spawn.x, this.world.spawn.y, 7);

    this.interact.reset();
    this.interact.add("exit", this.world.portal.x, this.world.portal.y, {});

    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;

    this.fx.text(this.player.x, this.player.y - 16, "NODE: SURVIVE + TOUCH PORTAL", "rgba(179,136,255,0.95)");
    this.fx.hitFlash(0.12);
    this.quest.done("node");
  }

  exitNode(){
    this.room = "forest";
    this.world = this.forest;

    this.cam.setWorld(this.world.worldW, this.world.worldH);

    this.enemies = new EnemyManager(this.world);
    this.enemies.reset();
    this.enemies.spawnWave(this.player.x, this.player.y, 6);

    this.interact.reset();

    this.interact.add("note", this.world.spawn.x + 40, this.world.spawn.y + 10, {
      text:
        "THE FOREST IS A SIMULATION WITH TEETH.\n"+
        "SHARDS ARE ITS EYES.\n"+
        "THE KEY REMEMBERS WHAT YOU FORGOT."
    });

    const chest = this.findOpenSpot(this.world.spawn.x, this.world.spawn.y, 160);
    this.interact.add("chest", chest.x, chest.y, { contains:"key", opened: this.inv.key });

    const gate = this.findOpenSpot(this.world.spawn.x, this.world.spawn.y, 220);
    this.interact.add("gate", gate.x, gate.y, { locked: !this.quest.isDone("gate") });
    this.interact.add("entrance", gate.x + 42, gate.y, {});

    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;

    this.fx.text(this.player.x, this.player.y - 16, "BACK TO FOREST", "rgba(255,255,255,0.8)");
    this.fx.hitFlash(0.10);
  }

  update(dt){
    if (this.state !== "play") return;

    // weapons safe tick
    if (this.weapons) this.weapons.update(dt);

    // activate forest portal after shards
    if (this.room === "forest"){
      this.world.setPortalActive(this.pickups.done());
    }

    // dash
    if (this.input.dash()){
      if (this.player.tryDash()){
        this.cam.kick(3.0, 0.10);
        this.fx.sparks(this.player.x, this.player.y, 8);
      }
    }

    // attack
    if (this.input.attack()){
      const ok = this.player.tryAttack();
      const canW = this.weapons ? this.weapons.canAttack() : true;

      if (ok && canW){
        if (this.weapons) this.weapons.commitAttack();

        // build hitbox
        const hb = this.weapons
          ? this.weapons.makeMeleeHitbox(this.player)
          : this.player.attack();

        if (hb){
          const kills = this.enemies.hits(hb);
          if (kills > 0){
            this.drops.spawn(hb.x, hb.y, kills);
            const xp = kills * 6;
            this.player.addXP(xp);
            this.fx.text(this.player.x, this.player.y - 10, `+${xp} XP`, "rgba(125,255,177,0.85)");
            this.fx.hitFlash(0.10);
          }
          this.cam.kick(1.8, 0.06);
          this.fx.burst(hb.x, hb.y, 10, "rgba(179,136,255,0.9)");
        }
      }
    }

    // movement
    this.player.update(dt, this.input, this.world);

    // enemies
    this.enemies.update(dt, this.player);

    // drops
    this.drops.update(dt);
    const got = this.drops.collect(this.player);
    if (got){
      this.player.heal(got * 2);
      this.player.addXP(got);
      this.fx.text(this.player.x, this.player.y - 12, `+${got*2} HP`, "rgba(125,255,177,0.85)");
    }

    // shards
    if (this.pickups.collect(this.player)){
      this.cam.kick(5.5, 0.14);
      this.fx.hitFlash(0.12);
      this.fx.text(this.player.x, this.player.y - 18, "SHARD +1", "rgba(179,136,255,0.95)");
      this.fx.burst(this.player.x, this.player.y, 14);
    }

    // interactions
    const evt = this.interact.tryInteract(this.player, this.input.interact());
    if (evt){
      if (evt.type === "note"){
        this.quest.done("read");
        const msg = evt.obj.data?.text || "THE NOTE IS BLANK.";
        const lines = msg.split("\n");
        this.fx.text(this.player.x, this.player.y - 26, lines[0]||"", "rgba(255,255,255,0.8)");
        this.fx.text(this.player.x, this.player.y - 38, lines[1]||"", "rgba(255,255,255,0.65)");
        this.fx.text(this.player.x, this.player.y - 50, lines[2]||"", "rgba(255,255,255,0.65)");
        this.fx.hitFlash(0.10);
      }

      if (evt.type === "chest"){
        if (!evt.obj.data.opened){
          evt.obj.data.opened = true;
          if (evt.obj.data.contains === "key"){
            this.interact.add("key", evt.obj.x + 16, evt.obj.y - 4, {});
            this.fx.text(this.player.x, this.player.y - 18, "CHEST OPENED", "rgba(125,255,177,0.85)");
            this.fx.burst(evt.obj.x, evt.obj.y, 18);
          }
        } else {
          this.fx.text(this.player.x, this.player.y - 18, "CHEST EMPTY", "rgba(255,255,255,0.6)");
        }
      }

      if (evt.type === "key"){
        this.inv.key = true;
        this.quest.done("key");
        this.fx.text(this.player.x, this.player.y - 18, "KEY ACQUIRED", "rgba(125,255,177,0.85)");
        this.fx.burst(evt.obj.x, evt.obj.y, 14, "rgba(125,255,177,0.85)");
        // remove the key interactable
        evt.obj.type = "dead";
        this.interact.list = this.interact.list.filter(o => o.type !== "dead");
      }

      if (evt.type === "gate"){
        if (!this.inv.key){
          this.fx.text(this.player.x, this.player.y - 18, "NEED KEY", "rgba(255,74,122,0.85)");
        } else {
          evt.obj.data.locked = false;
          this.quest.done("gate");
          this.fx.text(this.player.x, this.player.y - 18, "GATE OPENED", "rgba(125,255,177,0.85)");
          this.fx.hitFlash(0.10);
        }
      }

      if (evt.type === "entrance"){
        const gateOk = this.quest.isDone("gate") || this.pickups.done();
        if (!gateOk){
          this.fx.text(this.player.x, this.player.y - 18, "FOREST RESISTS", "rgba(255,74,122,0.85)");
        } else {
          this.enterNode();
        }
      }

      if (evt.type === "exit"){
        this.quest.done("exit");
        this.fx.text(this.player.x, this.player.y - 18, "NODE COMPLETE", "rgba(125,255,177,0.85)");
        this.exitNode();
      }
    }

    // waves: only spawn when cleared
    this.waveTimer -= dt;
    if (this.waveTimer <= 0){
      if (this.enemies.alive() === 0){
        const count = (this.room === "node") ? 8 : 6;
        this.enemies.spawnWave(this.player.x, this.player.y, count);
        this.fx.text(this.player.x, this.player.y - 26, "WAVE INCOMING", "rgba(255,255,255,0.7)");
        this.waveTimer = 10;
      } else {
        this.waveTimer = 0.5;
      }
    }

    // camera
    this.cam.update(dt, this.player.x, this.player.y);

    // node completion by portal touch
    if (this.room === "node" && this.world.inPortal(this.player.x, this.player.y, this.player.r)){
      this.quest.done("exit");
      this.exitNode();
    }

    // win
    if (this.quest.isDone("exit")){
      this.state = "win";
      this.fx.hitFlash(0.18);
    }

    // death
    if (this.player.hp <= 0){
      this.state = "dead";
      this.cam.kick(14, 0.22);
      this.fx.hitFlash(0.18);
    }

    this.fx.update(dt);
  }

  draw(ctx){
    // world layer draw happens on world canvas in main, but scene draws onto ctx.
    // We still draw the world here for simplicity (single world canvas).
    const t = performance.now()/1000;

    const shake = this.cam.getShake();
    const camX = (this.cam.x + shake.sx)|0;
    const camY = (this.cam.y + shake.sy)|0;

    this.world.draw(ctx, camX, camY, t);

    // world objects
    if (this.room === "forest") this.pickups.draw(ctx, camX, camY);
    this.drops.draw(ctx, camX, camY);
    this.enemies.draw(ctx, camX, camY);
    this.interact.draw(ctx, camX, camY);
    this.player.draw(ctx, camX, camY);
    this.fx.drawWorld(ctx, camX, camY);

    // overlay flash
    this.fx.drawOverlay(ctx, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  drawUI(ctx2, fps){
    // HUD panel
    const pad = 8;

    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(pad, pad, 210, 70);

    // HP bar
    const barW = 190;
    const hp = clamp(this.player.hp / this.player.hpMax, 0, 1);

    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(pad+10, pad+10, barW, 10);

    ctx2.fillStyle = "rgba(255,74,122,0.95)";
    ctx2.fillRect(pad+10, pad+10, (barW*hp)|0, 10);

    // XP bar
    const xp = clamp(this.player.xp / this.player.xpNext, 0, 1);
    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(pad+10, pad+26, barW, 6);
    ctx2.fillStyle = "rgba(179,136,255,0.95)";
    ctx2.fillRect(pad+10, pad+26, (barW*xp)|0, 6);

    ctx2.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx2.textBaseline = "top";
    ctx2.fillStyle = "rgba(255,255,255,0.8)";
    ctx2.fillText(`FPS ${fps}`, pad+10, pad+38);
    ctx2.fillText(`LV ${this.player.level}`, pad+70, pad+38);

    ctx2.fillStyle = "rgba(255,255,255,0.65)";
    ctx2.fillText(`ROOM ${this.room.toUpperCase()}`, pad+120, pad+38);

    ctx2.fillStyle = this.inv.key ? "rgba(125,255,177,0.85)" : "rgba(255,255,255,0.45)";
    ctx2.fillText(this.inv.key ? "KEY YES" : "KEY NO", pad+10, pad+52);

    if (this.weapons){
      ctx2.fillStyle = "rgba(255,255,255,0.65)";
      ctx2.fillText(this.weapons.getHudText(), pad+80, pad+52);
    }

    // interact prompt
    if (this.interact.prompt){
      ctx2.fillStyle = "rgba(255,255,255,0.85)";
      ctx2.fillText(this.interact.prompt, pad+10, pad+64);
    }

    // win/dead overlay
    if (this.state === "win" || this.state === "dead"){
      ctx2.fillStyle = "rgba(0,0,0,0.55)";
      ctx2.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);

      ctx2.textAlign = "center";
      ctx2.fillStyle = "rgba(179,136,255,0.95)";
      ctx2.font = "18px ui-monospace, Menlo, Consolas, monospace";
      ctx2.fillText(this.state === "win" ? "REALM CLEARED" : "YOU DIED", CONFIG.WIDTH/2, 66);

      ctx2.fillStyle = "rgba(255,255,255,0.8)";
      ctx2.font = "12px ui-monospace, Menlo, Consolas, monospace";
      ctx2.fillText("PRESS R TO RESTART", CONFIG.WIDTH/2, 94);
      ctx2.textAlign = "left";
    }
  }
}
