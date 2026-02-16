export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const rand = (a,b)=> a + Math.random()*(b-a);
export const rint = (a,b)=> (a + Math.random()*(b-a+1))|0;

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

