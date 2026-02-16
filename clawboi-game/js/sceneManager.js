export class Scenes{
  constructor(){
    this.stack = [];
  }
  push(scene){
    this.stack.push(scene);
    if (scene && typeof scene.onEnter === "function") scene.onEnter();
  }
  pop(){
    const s = this.stack.pop();
    if (s && typeof s.onExit === "function") s.onExit();
    return s;
  }
  clear(){
    while(this.stack.length) this.pop();
  }
  top(){
    return this.stack[this.stack.length-1] || null;
  }
  update(dt){
    const s = this.top();
    if (s && typeof s.update === "function") s.update(dt);
  }
  draw(ctx){
    const s = this.top();
    if (s && typeof s.draw === "function") s.draw(ctx);
  }
}
