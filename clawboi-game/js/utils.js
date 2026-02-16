export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t){ return a + (b - a) * t; }
export function now(){ return performance.now(); }

export function rand(a=0, b=1){ return a + Math.random() * (b - a); }
export function randi(a, b){ return (a + Math.floor(Math.random() * (b - a + 1))); }

export function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

export function fmt(n, d=0){
  if (!Number.isFinite(n)) return "0";
  const p = Math.pow(10, d);
  return String(Math.round(n*p)/p);
}

export function isTouchDevice(){
  return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
}

export function aabbCircle(cx, cy, r, x, y, w, h){
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  return (dx*dx + dy*dy) <= r*r;
}

