// scaler.js — keep internal resolution fixed, scale via CSS only (crash-proof)

import { CONFIG } from "./config.js";

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function calcScale(){
  const vv = window.visualViewport;
  const ww = vv ? vv.width  : window.innerWidth;
  const wh = vv ? vv.height : window.innerHeight;

  const sx = Math.floor(ww / CONFIG.WIDTH);
  const sy = Math.floor(wh / CONFIG.HEIGHT);

  const s = Math.min(sx, sy) || 1;
  return clamp(s, CONFIG.MIN_SCALE || 1, CONFIG.MAX_SCALE || 6);
}

export function scale(...canvases){
  function apply(){
    const s = calcScale();
    const cssW = CONFIG.WIDTH * s;
    const cssH = CONFIG.HEIGHT * s;

    for (const c of canvases){
      if (!c) continue;

      // internal render resolution (NEVER change)
      c.width  = CONFIG.WIDTH;
      c.height = CONFIG.HEIGHT;

      // CSS display size (ONLY thing that scales)
      c.style.width  = cssW + "px";
      c.style.height = cssH + "px";
    }
  }

  window.addEventListener("resize", apply, { passive: true });
  apply();
}




<script type="module" src="./js/main.js"></script>
