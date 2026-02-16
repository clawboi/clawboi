import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

export function scale(worldCanvas, fxCanvas, uiCanvas){
  function calcScale(){
    const vv = window.visualViewport;
    const ww = vv ? vv.width : window.innerWidth;
    const wh = vv ? vv.height : window.innerHeight;

    const sx = Math.floor(ww / CONFIG.WIDTH);
    const sy = Math.floor((wh - 120) / CONFIG.HEIGHT); // leave space for UI
    const s = Math.min(sx, sy) || 1;
    return clamp(s, 1, 6);
  }

  function apply(){
    const s = calcScale();

    // internal size fixed
    for (const c of [worldCanvas, fxCanvas, uiCanvas]){
      c.width = CONFIG.WIDTH;
      c.height = CONFIG.HEIGHT;
      c.style.width = (CONFIG.WIDTH * s) + "px";
      c.style.height = (CONFIG.HEIGHT * s) + "px";
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
    }

    // update CSS var so the container matches canvas size
    document.documentElement.style.setProperty("--scale", String(s));
    document.documentElement.style.setProperty("--baseW", CONFIG.WIDTH + "px");
    document.documentElement.style.setProperty("--baseH", CONFIG.HEIGHT + "px");
  }

  window.addEventListener("resize", apply, { passive:true });
  apply();
}

