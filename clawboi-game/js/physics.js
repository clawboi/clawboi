export const Physics={

move(e,dt){
e.x+=e.vx*dt;
e.y+=e.vy*dt;
},

circle(a,b){
let dx=a.x-b.x;
let dy=a.y-b.y;
let r=a.r+b.r;
return dx*dx+dy*dy<r*r;
}

};
