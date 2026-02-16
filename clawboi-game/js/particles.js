export class Particles{

constructor(){this.p=[]}

burst(x,y,c=12){
for(let i=0;i<c;i++)
this.p.push({
x,y,
vx:(Math.random()-.5)*200,
vy:(Math.random()-.5)*200,
t:.6
});
}

update(dt){
for(let p of this.p){
p.t-=dt;
p.x+=p.vx*dt;
p.y+=p.vy*dt;
}
this.p=this.p.filter(p=>p.t>0);
}

draw(ctx,cam){
ctx.fillStyle="#c084ff";
for(let p of this.p)
ctx.fillRect(p.x-cam.x,p.y-cam.y,2,2);
}

}
