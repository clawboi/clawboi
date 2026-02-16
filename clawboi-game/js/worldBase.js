export class World{

constructor(w,h){
this.worldW=w;
this.worldH=h;
this.entities=[];
}

add(e){this.entities.push(e)}

update(dt){
for(let e of this.entities)
if(!e.dead&&e.update)e.update(dt,this);
}

draw(ctx,cam){
for(let e of this.entities)
if(!e.dead&&e.draw)e.draw(ctx,cam);
}

}
