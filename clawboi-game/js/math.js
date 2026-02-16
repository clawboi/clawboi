export const M={

clamp:(v,a,b)=>v<a?a:v>b?b:v,
lerp:(a,b,t)=>a+(b-a)*t,
rand:(a,b)=>Math.random()*(b-a)+a,
chance:p=>Math.random()<p,

dist:(x1,y1,x2,y2)=>{
let dx=x2-x1;
let dy=y2-y1;
return Math.sqrt(dx*dx+dy*dy);
},

angle:(x1,y1,x2,y2)=>Math.atan2(y2-y1,x2-x1),

norm:(x,y)=>{
let d=Math.hypot(x,y)||1;
return{x:x/d,y:y/d};
}

};
