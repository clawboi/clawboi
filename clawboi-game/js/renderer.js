export class Renderer{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha:true });
    this.ctx.imageSmoothingEnabled = false;
  }
  clear(color){
    const c = this.ctx;
    c.setTransform(1,0,0,1,0,0);
    c.fillStyle = color;
    c.fillRect(0,0,this.canvas.width,this.canvas.height);
  }
}
