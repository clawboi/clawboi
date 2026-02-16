export const CONFIG = Object.freeze({
  WIDTH: 320,
  HEIGHT: 180,

  BASE_TILE: 8,

  BG: "#07070c",

  DT_CAP: 1 / 20,

  // camera
  CAM_SHAKE_DECAY: 9.0,

  // UI sizing (keeps HUD small)
  HUD_PAD: 8,
  HUD_FONT: "10px ui-monospace, Menlo, Consolas, monospace",

  // gameplay
  SHARDS_TOTAL: 3,
  WAVE_COOLDOWN: 10.0,

  // world sizes in pixels (big map, but minimap stays tiny)
  FOREST_W: 160 * 8,
  FOREST_H: 120 * 8,

  NODE_W: 80 * 8,
  NODE_H: 60 * 8,
});

