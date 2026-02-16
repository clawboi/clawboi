// /js/weapons.js
// Non-breaking Weapon System: safe defaults, no hard dependencies.

export const WEAPONS = Object.freeze({
  fists: {
    id: "fists",
    name: "FISTS",
    dmg: 10,
    kb: 180,
    range: 14,
    radius: 12,
    cooldown: 0.20,
    color: "white",
  },

  claw: {
    id: "claw",
    name: "CLAW",
    dmg: 14,
    kb: 220,
    range: 16,
    radius: 14,
    cooldown: 0.18,
    color: "violet",
  },

  blade: {
    id: "blade",
    name: "BLADE",
    dmg: 20,
    kb: 260,
    range: 20,
    radius: 16,
    cooldown: 0.28,
    color: "violet",
  },

  shotgun: {
    id: "shotgun",
    name: "SHOTGUN",
    dmg: 7,
    kb: 140,
    range: 26,
    radius: 10,
    cooldown: 0.42,
    color: "white",
    pellets: 6,
    spread: 0.55, // radians
  },
});

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export class WeaponSystem {
  constructor(opts = {}) {
    this.enabled = opts.enabled !== false;
    this.currentId = opts.defaultId || "claw";
    this.cooldown = 0;
  }

  set(id) {
    if (!WEAPONS[id]) return false;
    this.currentId = id;
    return true;
  }

  get current() {
    return WEAPONS[this.currentId] || WEAPONS.fists;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  canAttack() {
    return this.enabled && this.cooldown <= 0;
  }

  /** Returns a standard hitbox object your enemies system can consume. */
  makeMeleeHitbox(player) {
    const w = this.current;
    const face = player?.face || { x: 1, y: 0 };

    const px = player?.x ?? 0;
    const py = player?.y ?? 0;
    const lvl = player?.level ?? 1;

    // Scales gently with level, but never goes insane:
    const dmg = (w.dmg + Math.floor((lvl - 1) * 1.25)) | 0;

    return {
      x: px + face.x * w.range,
      y: py + face.y * w.range,
      r: w.radius,
      dmg,
      kb: w.kb,
      weaponId: w.id,
    };
  }

  /** Optional: multi-hitboxes for "shotgun-like" melee cones, still safe if unused. */
  makePelletHitboxes(player) {
    const w = this.current;
    if (!w.pellets) return [this.makeMeleeHitbox(player)];

    const face = player?.face || { x: 1, y: 0 };
    const ang = Math.atan2(face.y, face.x);

    const px = player?.x ?? 0;
    const py = player?.y ?? 0;
    const lvl = player?.level ?? 1;

    const pellets = w.pellets | 0;
    const spread = w.spread || 0.4;

    const out = [];
    for (let i = 0; i < pellets; i++) {
      const t = pellets === 1 ? 0.5 : i / (pellets - 1);
      const a = ang + (t - 0.5) * spread;

      out.push({
        x: px + Math.cos(a) * w.range,
        y: py + Math.sin(a) * w.range,
        r: w.radius,
        dmg: (w.dmg + Math.floor((lvl - 1) * 0.8)) | 0,
        kb: w.kb,
        weaponId: w.id,
        pellet: i,
      });
    }
    return out;
  }

  /** Call when an attack succeeds to start cooldown. */
  commitAttack() {
    const w = this.current;
    this.cooldown = Math.max(this.cooldown, w.cooldown || 0.2);
  }

  /** UI helper */
  getHudText() {
    const w = this.current;
    const cd = this.cooldown;
    const cdPct = w.cooldown ? clamp01(1 - cd / w.cooldown) : 1;
    const bar = "▮".repeat(Math.floor(cdPct * 8)).padEnd(8, "▯");
    return `${w.name} [${bar}]`;
  }
}
