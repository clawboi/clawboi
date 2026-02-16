// Optional, but safe. If you never use it, nothing breaks.
export class WeaponSystem{
  constructor({ enabled=true, defaultId="claw" }={}){
    this.enabled = enabled;
    this.id = defaultId;
    this.cool = 0;
  }

  set(id){ this.id = id; }
  getHudText(){ return `WEAPON: ${this.id.toUpperCase()}`; }

  update(dt){ this.cool = Math.max(0, this.cool - dt); }
  canAttack(){ return this.cool <= 0; }
  commitAttack(){
    // simple cooldowns
    const cd = (this.id === "shotgun") ? 0.40 : (this.id === "blade" ? 0.18 : 0.12);
    this.cool = cd;
  }

  makeMeleeHitbox(player){
    const dirx = player.face.x || 1;
    const diry = player.face.y || 0;

    const baseR = (this.id === "blade") ? 16 : 14;
    const dmg   = (this.id === "blade") ? 18 : 14;

    return {
      x: player.x + dirx * 14,
      y: player.y + diry * 14,
      r: baseR,
      dmg: dmg + ((player.level|0) * 2),
      kb: 220,
    };
  }
}
