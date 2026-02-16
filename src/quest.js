export class Quest {
  constructor(){
    this.steps = [];
  }

  reset(){
    this.steps = [
      { id:"shards", text:"Collect 3 Shards", done:false },
      { id:"read",  text:"Read the Note",      done:false },
      { id:"key",   text:"Find the Key",       done:false },
      { id:"gate",  text:"Open the Gate",      done:false },
      { id:"node",  text:"Enter the Forest Node", done:false },
      { id:"exit",  text:"Return Through the Node", done:false },
    ];
  }

  done(id){
    const s = this.steps.find(x=>x.id===id);
    if(s) s.done = true;
  }

  isDone(id){
    const s = this.steps.find(x=>x.id===id);
    return !!(s && s.done);
  }

  // handy: mark "shards" done externally
  setShardsDone(v=true){
    const s = this.steps.find(x=>x.id==="shards");
    if(s) s.done = !!v;
  }

  list(){
    return this.steps;
  }
}

