export class Scenes{
  constructor(){
    this.stack = [];
  }
  push(s){ this.stack.push(s); }
  pop(){ return this.stack.pop(); }
  clear(){ this.stack.length = 0; }
  top(){ return this.stack[this.stack.length - 1] || null; }

  update(dt){
    const s = this.top();
    if (s && typeof s.update === "function") s.update(dt);
  }
  draw(ctx){
    const s = this.top();
    if (s && typeof s.draw === "function") s.draw(ctx);
  }
}

