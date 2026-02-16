export class WeaponSystem{
  constructor(){
    this.id = "punch";
    this.cool = 0;
  }

  set(id){ this.id = id; }

  update(dt){
    this.cool = Math.max(0, this.cool - dt);
  }

  canAttack(){
    return this.cool <= 0;
  }

  commitAttack(){
    // different weapons have different cooldowns
    if (this.id === "gun") this.cool = 0.22;
    else if (this.id === "claw") this.cool = 0.18;
    else this.cool = 0.16; // punch
  }

  hud(){
    if (this.id === "gun") return "WEAPON: GUN";
    if (this.id === "claw") return "WEAPON: CLAW";
    return "WEAPON: PUNCH";
  }

  makeHit(player){
    const dirx = player.face.x;
    const diry = player.face.y;

    if (this.id === "gun"){
      // projectile-like hitbox (long thin)
      return {
        type:"ray",
        x1: player.x,
        y1: player.y,
        x2: player.x + dirx * 90,
        y2: player.y + diry * 90,
        dmg: 12 + player.level*2,
        kb: 140,
      };
    }

    const r = (this.id === "claw") ? 16 : 14;
    const dmg = (this.id === "claw") ? 16 : 12;

    return {
      type:"circle",
      x: player.x + dirx * 14,
      y: player.y + diry * 14,
      r,
      dmg: dmg + player.level*2,
      kb: 220,
    };
  }
}

