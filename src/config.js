export const CONFIG = {

  /* ========= BASE RESOLUTION =========
     Internal game resolution.
     Camera + physics depend on this.
  */
  baseW: 320,
  baseH: 180,

  /* ========= SCALING =========
     CSS upscaling multiplier range
  */
  minScale: 1,
  maxScale: 6,

  /* ========= TIMING =========
     Prevent physics explosions if tab lags
  */
  dtCap: 0.05,

  /* ========= COLORS ========= */
  bg: "#0b0b12",

  /* ========= PLAYER ========= */
  playerSpeed: 120,
  dashSpeed: 340,
  dashTime: 0.14,
  dashCooldown: 0.35,

  attackCooldown: 0.18,

  /* ========= COMBAT ========= */
  enemySpeed: 60,
  enemyDamage: 10,

  /* ========= WORLD ========= */
  tileSize: 8,

  /* ========= CAMERA ========= */
  camFollow: 8,      // higher = tighter camera
  camShakeDecay: 6,  // shake fade speed

  /* ========= WAVES ========= */
  waveDelay: 10,

};
