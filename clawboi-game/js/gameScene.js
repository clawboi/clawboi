import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

import { WorldForest } from "./world_forest.js";
import { WorldNode } from "./world_node.js";

import { PlayerTest } from "./player_test.js";
import { EnemyManager } from "./enemies.js";
import { PickupManager } from "./pickups.js";
import { DropManager } from "./drops.js";
import { FX } from "./fx.js";
import { Quest } from "./quest.js";
import { Interactables } from "./interactables.js";
import { WeaponSystem } from "./weapons.js";

export class GameScene{
  constructor(cam, input){
    this.cam = cam;
    this.input = input;

    this.state = "start"; // start | play | win | dead

    this.room = "forest";
    this.forest = null;
    this.node = null;
    this.world = null;

    this.player = null;
    this.enemies = null;
    this.pickups = null;
    this.drops = null;
    this.fx = null;
    this.quest = null;
    this.interact = null;
    this.weapons = null;

    this.inv = { key:false };

    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = 96;
    this.mapCanvas.height = 72;
    this.mapDirty = true;

    this.waveCooldown = 0;
    this.tWorld = 0;

    // interact key separate
    this.interactPressed = false;
    window.addEventListener("keydown",(e)=>{
      if ((e.key||"").toLowerCase() === "e") this.interactPressed = true;
    });

    this.startGame();
  }

  startGame(){
    this.forest = new WorldForest();
    this.node = new WorldNode();
    this.world = this.forest;
    this.room = "forest";

    this.player = new PlayerTest(this.world.spawn.x, this.world.spawn.y);

    this.cam.setWorld(this.world.worldW, this.world.worldH);

    this.enemies = new EnemyManager(this.world);
    this.pickups = new PickupManager();
    this.pickups.reset(CONFIG.SHARDS_TOTAL);

    this.drops = new DropManager();
    this.drops.reset();

    this.fx = new FX();
    this.fx.reset();

    this.quest = new Quest();
    this.quest.reset();

    this.interact = new Interactables();
    this.interact.reset();

    this.weapons = new WeaponSystem();

    this.inv.key = false;

    // place shards + chest + gate
    for (let i=0;i<CONFIG.SHARDS_TOTAL;i++){
      const x = this.world.spawn.x + 120 + i*90;
      const y = this.world.spawn.y + 40 + (i%2)*70;
      this.pickups.addShard(x,y);
    }

    this.interact.add("chest", this.world.spawn.x + 120, this.world.spawn.y + 10, { contains:"key" });
    this.interact.add("gate", this.world.portal.x - 60, this.world.portal.y, { locked:true });

    this.enemies.reset();
    this.enemies.spawnWaveAround(this.player.x, this.player.y, this.player.level);
    this.waveCooldown = CONFIG.WAVE_COOLDOWN;

    this.mapDirty = true;
    this.rebuildMinimap();

    this.state = "play";
  }

  rebuildMinimap(){
    this.mapDirty = false;
    const c = this.mapCanvas.getContext("2d");
    c.clearRect(0,0,96,72);
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(0,0,96,72);

    // simple: show bounds + portal marker
    c.strokeStyle = "rgba(179,136,255,0.55)";
    c.strokeRect(1,1,94,70);

    c.fillStyle = "rgba(179,136,255,0.35)";
    c.fillRect(0,0,96,72);
  }

  enterNode(){
    this.room = "node";
    this.world = this.node;

    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;

    this.cam.setWorld(this.world.worldW, this.world.worldH);

    this.enemies = new EnemyManager(this.world);
    this.enemies.reset();
    this.enemies.spawnWaveAround(this.player.x, this.player.y, this.player.level);

    this.quest.done("node");

    this.mapDirty = true;
    this.rebuildMinimap();

    this.fx.text(this.player.x, this.player.y - 14, "ENTERED NODE", "rgba(179,136,255,0.85)");
    this.fx.hitFlash(0.10);
  }

  exitNode(){
    this.room = "forest";
    this.world = this.forest;

    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;

    this.cam.setWorld(this.world.worldW, this.world.worldH);

    this.enemies = new EnemyManager(this.world);
    this.enemies.reset();
    this.enemies.spawnWaveAround(this.player.x, this.player.y, this.player.level);

    this.mapDirty = true;
    this.rebuildMinimap();

    this.fx.text(this.player.x, this.player.y - 14, "BACK TO FOREST", "rgba(255,255,255,0.7)");
  }

  update(dt){
    if (this.state !== "play") return;

    this.tWorld += dt;

    // weapon swap safe
    // (keys handled in main.js)
    this.weapons.update(dt);

    // portal activation
    if (this.room==="forest") this.world.setPortalActive(this.pickups.done());

    // dash
    if (this.input.dash()){
      if (this.player.tryDash()){
        this.cam.kick(3.8, 0.10);
        this.fx.sparksHit(this.player.x, this.player.y, 10);
      }
    }

    // attack
    if (this.input.attack()){
      const ok = this.player.tryAttack();
      const can = this.weapons.canAttack();
      if (ok && can){
        this.weapons.commitAttack();
        const hb = this.weapons.makeHit(this.player);

        // resolve hit
        const h = this.enemies.resolvePlayerAttack(this.player, hb);

        if (hb.type==="ray"){
          // draw quick ray effect (via FX particles)
          for (let i=0;i<20;i++){
            const t = i/20;
            const x = hb.x1 + (hb.x2-hb.x1)*t;
            const y = hb.y1 + (hb.y2-hb.y1)*t;
            this.fx.burst(x,y,1);
          }
        } else {
          this.fx.sparksHit(hb.x, hb.y, 12);
        }

        if (h.count>0){
          this.cam.kick(2.3 + h.count*0.5, 0.08);
          this.fx.hitFlash(0.08);
        }

        if (h.kills>0){
          const xp = h.kills * 6;
          this.player.addXP(xp);
          // small chance of HP drops
          if (Math.random() < 0.55) this.drops.spawnHP(this.player.x+10, this.player.y+6, 1);
          this.fx.text(this.player.x, this.player.y - 12, `+${xp} XP`, "rgba(125,255,177,0.85)");
        }
      }
    }

    // move + enemy update
    this.player.update(dt, this.input, this.world);
    this.enemies.update(dt, this.player);

    // shards + drops
    this.pickups.update(dt);
    if (this.pickups.tryCollect(this.player)){
      this.fx.text(this.player.x, this.player.y - 14, "SHARD +1", "rgba(179,136,255,0.9)");
      this.fx.hitFlash(0.10);
      this.cam.kick(4.8, 0.12);
      if (this.pickups.done()) this.quest.setShardsDone(true);
    }

    const got = this.drops.tryCollect(this.player);
    if (got){
      this.player.heal(got*8);
      this.fx.text(this.player.x, this.player.y - 14, `+${got*8} HP`, "rgba(125,255,177,0.85)");
    }

    // interactions (key / gate)
    const evt = this.interact.tryInteract(this.player, this.interactPressed);
    if (evt){
      if (evt.type === "chest"){
        if (evt.obj.data.contains === "key"){
          // spawn key nearby once
          evt.obj.data.contains = "empty";
          this.interact.add("key", evt.obj.x + 18, evt.obj.y - 4, {});
          this.fx.text(this.player.x, this.player.y - 14, "CHEST OPENED", "rgba(125,255,177,0.75)");
        }
      }
      if (evt.type === "key"){
        this.inv.key = true;
        this.quest.done("gate");
        this.fx.text(this.player.x, this.player.y - 14, "KEY ACQUIRED", "rgba(125,255,177,0.85)");
        // remove key object
        evt.obj.type = "gone";
      }
      if (evt.type === "gate"){
        const canOpen = this.inv.key || this.pickups.done();
        if (canOpen){
          this.quest.done("gate");
          this.fx.text(this.player.x, this.player.y - 14, "GATE OPEN", "rgba(125,255,177,0.85)");
          this.enterNode();
        } else {
          this.fx.text(this.player.x, this.player.y - 14, "NEED SHARDS OR KEY", "rgba(255,74,122,0.85)");
        }
      }
    }

    // remove gone interactables
    this.interact.items = this.interact.items.filter(i=>i.type!=="gone");

    this.interactPressed = false;

    // waves: 10s downtime ONLY after cleared
    this.waveCooldown -= dt;
    if (this.waveCooldown <= 0){
      if (this.enemies.aliveCount() === 0){
        this.enemies.spawnWaveAround(this.player.x, this.player.y, this.player.level);
        this.waveCooldown = CONFIG.WAVE_COOLDOWN;
        this.fx.text(this.player.x, this.player.y - 18, "WAVE INCOMING", "rgba(255,255,255,0.7)");
      } else {
        this.waveCooldown = 0.35; // re-check soon
      }
    }

    // win condition in node: touch portal
    if (this.room==="node" && this.world.inPortal(this.player.x, this.player.y, this.player.r)){
      this.quest.done("exit");
      this.state = "win";
      this.fx.text(this.player.x, this.player.y - 18, "NODE COMPLETE", "rgba(125,255,177,0.85)");
      this.fx.hitFlash(0.15);
    }

    // death
    if (this.player.hp <= 0){
      this.state = "dead";
      this.fx.hitFlash(0.2);
      this.cam.kick(10, 0.25);
    }

    // camera follow
    this.cam.update(dt, this.player.x, this.player.y);
  }

  draw(ctx){
    // draw world on world canvas; FX/UI drawn in main
    const { sx, sy } = this.cam.getShakeOffset();
    this._camX = (this.cam.x + sx) | 0;
    this._camY = (this.cam.y + sy) | 0;
    this.world.draw(ctx, this._camX, this._camY, this.tWorld);

    // world entities
    if (this.room==="forest") this.pickups.draw(ctx, this._camX, this._camY);
    this.drops.draw(ctx, this._camX, this._camY);
    this.enemies.draw(ctx, this._camX, this._camY);
    this.interact.draw(ctx, this._camX, this._camY);
    this.player.draw(ctx, this._camX, this._camY);
  }

  drawFX(ctx){
    this.fx.drawWorld(ctx, this._camX, this._camY);
  }

  drawUI(ctx){
    const pad = CONFIG.HUD_PAD;

    // small panels (NOT giant)
    ctx.save();
    ctx.font = CONFIG.HUD_FONT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // left panel
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, pad, 164, 56);

    // HP bar
    const hp = this.player.hp / this.player.hpMax;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(pad+8, pad+8, 140, 8);
    ctx.fillStyle = "rgba(255,74,122,0.95)";
    ctx.fillRect(pad+8, pad+8, (140*hp)|0, 8);

    // XP bar
    const xp = this.player.xp / this.player.xpNext;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(pad+8, pad+20, 140, 6);
    ctx.fillStyle = "rgba(179,136,255,0.95)";
    ctx.fillRect(pad+8, pad+20, (140*xp)|0, 6);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`LV ${this.player.level}  ${this.weapons.hud()}`, pad+8, pad+30);

    ctx.fillStyle = this.inv.key ? "rgba(125,255,177,0.85)" : "rgba(255,255,255,0.45)";
    ctx.fillText(this.inv.key ? "KEY: YES" : "KEY: NO", pad+8, pad+42);

    // right panel + minimap (fixed tiny)
    const rightW = 120;
    const rightX = CONFIG.WIDTH - rightW - pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(rightX, pad, rightW, 96);

    // minimap
    if (this.mapDirty) this.rebuildMinimap();
    ctx.drawImage(this.mapCanvas, rightX+12, pad+8);

    // markers
    const MW=96, MH=72;
    const px = (this.player.x / this.world.worldW) * MW;
    const py = (this.player.y / this.world.worldH) * MH;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect((rightX+12 + px)|0, (pad+8 + py)|0, 2, 2);

    // portal marker
    if (this.world.portal){
      const qx = (this.world.portal.x / this.world.worldW) * MW;
      const qy = (this.world.portal.y / this.world.worldH) * MH;
      ctx.fillStyle = (this.room==="forest") ? "rgba(179,136,255,0.9)" : "rgba(255,74,122,0.9)";
      ctx.fillRect((rightX+12 + qx)|0, (pad+8 + qy)|0, 2, 2);
    }

    // center overlays
    if (this.state==="win" || this.state==="dead"){
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      ctx.fillRect(0,0,CONFIG.WIDTH,CONFIG.HEIGHT);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(179,136,255,0.95)";
      ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText(this.state==="win" ? "REALM CLEARED" : "YOU DIED", CONFIG.WIDTH/2, 62);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("Press R to Restart", CONFIG.WIDTH/2, 86);
    }

    ctx.restore();
  }

  drawOverlay(ctx){
    this.fx.drawOverlay(ctx, CONFIG.WIDTH, CONFIG.HEIGHT);
  }
}

