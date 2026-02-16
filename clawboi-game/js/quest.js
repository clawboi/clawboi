export class Quest{
  constructor(){
    this.flags = new Map();
    this.steps = [
      { id:"shards", text:"Collect 3 shards", done:false },
      { id:"gate", text:"Open gate (key OR shards)", done:false },
      { id:"node", text:"Enter the node", done:false },
      { id:"exit", text:"Touch node portal", done:false },
    ];
  }

  reset(){
    this.flags.clear();
    for (const s of this.steps) s.done = false;
  }

  done(id){
    this.flags.set(id,true);
    const s = this.steps.find(x=>x.id===id);
    if (s) s.done = true;
  }

  isDone(id){ return this.flags.get(id) === true; }

  list(){ return this.steps; }

  setShardsDone(v){
    if (v) this.done("shards");
  }
}

