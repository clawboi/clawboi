export class Scenes{

constructor(){this.stack=[]}

push(s){this.stack.push(s)}
pop(){this.stack.pop()}
cur(){return this.stack[this.stack.length-1]}

update(dt){let s=this.cur();if(s&&s.update)s.update(dt)}
draw(ctx){let s=this.cur();if(s&&s.draw)s.draw(ctx)}

}
