// scaler.js - reliable canvas sizing for stacked canvases (world/fx/ui)
import { CONFIG } from "./config.js";

export function scale(worldCanvas, fxCanvas, uiCanvas) {
  const canvases = [worldCanvas, fxCanvas, uiCanvas].filter(Boolean);

  function resize() {
    // Size container (#stack) dictates display size
    const stack = document.getElementById("stack");
    const rect = stack ? stack.getBoundingClientRect() : null;

    // fallback: viewport
    const cssW = rect ? rect.width : window.innerWidth;
    const cssH = rect ? rect.height : window.innerHeight;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    // Internal resolution: either CONFIG base, or match CSS with DPR
    // If you want pixel-art fixed res, use CONFIG.WIDTH/HEIGHT
    const internalW = CONFIG.WIDTH;
    const internalH = CONFIG.HEIGHT;

    // Make canvases draw in fixed internal resolution (pixel art stable),
    // while CSS scales them to stack size.
    for (const c of canvases) {
      c.width = internalW;
      c.height = internalH;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  // Some mobile browsers change visualViewport while scrolling UI bars
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize, { passive: true });
  }

  resize();
}
