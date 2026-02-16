import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function calcScale(){
  const vv = window.visualViewport;
  const ww = vv ? vv.width : window.innerWidth;
  const wh = vv ? vv.height : window.innerHeight;

  const sx = Math.floor(ww / CONFIG.WIDTH);
  const sy = Math.floor(wh / CONFIG.HEIGHT);

  const s = Math.min(sx, sy) || CONFIG.MIN_SCALE;
  return clamp(s, CONFIG.MIN_SCALE, CONFIG.MAX_SCALE);
}

export function scale(worldCanvas, fxCanvas, uiCanvas){
  const root = document.getElementById("engineRoot");

  function apply(){
    const s = calcScale();

    // Internal resolution stays fixed
    for (const c of [worldCanvas, fxCanvas, uiCanvas]){
      c.width = CONFIG.WIDTH;
      c.height = CONFIG.HEIGHT;
      c.style.width = (CONFIG.WIDTH * s) + "px";
      c.style.height = (CONFIG.HEIGHT * s) + "px";
    }

    if (root){
      root.style.width = (CONFIG.WIDTH * s) + "px";
      root.style.height = (CONFIG.HEIGHT * s) + "px";
    }
  }

  window.addEventListener("resize", apply, { passive:true });
  apply();
}
