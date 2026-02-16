export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp  = (a, b, t) => a + (b - a) * t;

export function now(){
  return performance.now();
}

export function isTouchDevice(){
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
}

export function fmt(n, d=2){
  return Number.isFinite(n) ? n.toFixed(d) : String(n);
}

