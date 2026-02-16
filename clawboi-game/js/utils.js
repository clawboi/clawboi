export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const now   = () => performance.now();

export function isTouchDevice(){
  return (("ontouchstart" in window) || navigator.maxTouchPoints > 0);
}

export function fmt(n, d=0){
  const p = Math.pow(10, d);
  return (Math.round(n*p)/p).toFixed(d);
}

export function dist2(ax, ay, bx, by){
  const dx = ax - bx;
  const dy = ay - by;
  return dx*dx + dy*dy;
}

export function rand(a=1){
  return Math.random()*a;
}
