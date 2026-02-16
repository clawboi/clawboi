// sceneManager.js
export class Scenes {

  constructor(){
    this.stack = [];
  }

  push(scene){
    this.stack.push(scene);
  }

  pop(){
    this.stack.pop();
  }

  clear(){
    this.stack.length = 0;
  }

  update(dt){
    if(this.stack.length){
      const top = this.stack[this.stack.length-1];
      if(top.update) top.update(dt);
    }
  }

  draw(ctx){
    if(this.stack.length){
      const top = this.stack[this.stack.length-1];
      if(top.draw) top.draw(ctx);
    }
  }
}
