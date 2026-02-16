export class Renderer{

constructor(c){
this.c=c;
this.ctx=c.getContext("2d");
}

clear(col){
this.ctx.fillStyle=col;
this.ctx.fillRect(0,0,this.c.width,this.c.height);
}

}
