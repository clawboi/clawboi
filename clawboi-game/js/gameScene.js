import {Boss} from "./boss.js";
import {Portal} from "./portal.js";
import {Quests} from "./quests.js";
import {Particles} from "./particles.js";
import {drawMini} from "./minimap.js";
import {Player} from "./player.js";
import {EnemyManager} from "./enemies.js";
import {Drops} from "./drops.js";
import {Pickups} from "./pickups.js";
import {WorldForest} from "./worldForest.js";
import {drawHUD} from "./hud.js";

export class GameScene{

constructor(cam,input){

this.world=new WorldForest();
this.player=new Player(this.world.spawn.x,this.world.spawn.y);
this.enemies=new EnemyManager(this.world);
this.drops=new Drops();
this.pickups=new Pickups();

this.cam=cam;
this.input=input;

this.waveTimer=0;

for(let i=0;i<3;i++)
this.pickups.spawn(
this.world.spawn.x+Math.random()*400-200,
this.world.spawn.y+Math.random()*400-200
);
}

update(dt){

this.player.update(dt,this.input,this.world);

let atk=this.input.attack()?this.player.attack():null;

this.enemies.update(dt,this.player);

if(atk){
let h=this.enemies.hits(atk);
if(h)this.drops.spawn(atk.x,atk.y,h);
}

this.drops.update(dt,this.player);
this.player.gain(this.drops.collect(this.player));
this.pickups.collect(this.player);

this.waveTimer-=dt;

if(this.waveTimer<=0&&this.enemies.alive()==0){
this.enemies.spawn(this.player.x,this.player.y,3+this.player.level);
this.waveTimer=10;
}

this.cam.setWorld(this.world.worldW,this.world.worldH);
this.cam.follow(dt,this.player.x,this.player.y);
}

draw(ctx){

let o=this.cam.offset();
this.world.draw(ctx,o);

this.pickups.draw(ctx,o);
this.drops.draw(ctx,o);
this.enemies.draw(ctx,o);
this.player.draw(ctx,o);

drawHUD(ctx,this.player);
}

}
