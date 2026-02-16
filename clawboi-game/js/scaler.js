// scaler.js (pixel-safe, iOS-safe)
// Keeps internal canvas resolution fixed, scales ONLY with CSS.
// Prevents double-scaling + blurry pixels.

export function scale(worldCanvas, fxCanvas, uiCanvas, opts = {}) {
  const BASE_W = opts.baseW ?? 320;
  const BASE_H = opts.baseH ?? 180;
  const MIN_SCALE = opts.minScale ?? 1;
  const MAX_SCALE = opts.maxScale ?? 6;

  const canvases = [worldCanvas, fxCanvas, uiCanvas].filter(Boolean);

  // Internal render resolution never changes
  for (const c of canvases) {
    c.width = BASE_W;
    c.height = BASE_H;
    c.style.width = BASE_W + "px";
    c.style.height = BASE_H + "px";
    c.style.imageRendering = "pixelated";
    c.style.imageRendering = "crisp-edges";
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function getViewport() {
    // iOS Safari: visualViewport is the truth
    const vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight,
    };
  }

  function apply() {
    const { w, h } = getViewport();

    // find the engineRoot container (if present) so we can center it
    const root = document.getElementById("engineRoot") || null;

    // compute integer scale that fits in available space
    const sx = Math.floor(w / BASE_W);
    const sy = Math.floor(h / BASE_H);
    const s = clamp(Math.min(sx, sy) || MIN_SCALE, MIN_SCALE, MAX_SCALE);

    const pxW = BASE_W * s;
    const pxH = BASE_H * s;

    // Set CSS size only (internal stays base)
    for (const c of canvases) {
      c.style.width = pxW + "px";
      c.style.height = pxH + "px";
    }

    // If we have a root container, lock its size so layout stays clean
    if (root) {
      root.style.width = pxW + "px";
      root.style.height = pxH + "px";
      root.style.aspectRatio = "auto";
    }
  }

  // Apply now + on resize
  apply();

  // Resize triggers
  window.addEventListener("resize", apply, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", apply, { passive: true });
    window.visualViewport.addEventListener("scroll", apply, { passive: true });
  }

  // Return a tiny API in case you want it later
  return { apply };
}
