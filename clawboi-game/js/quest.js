export class Quest{
  constructor(){
    this.flags = Object.create(null);
  }

  reset(){
    this.flags = Object.create(null);
  }

  done(id){
    this.flags[id] = true;
  }

  isDone(id){
    return !!this.flags[id];
  }

  list(shardsCollected=0, shardTarget=3){
    return [
      { text: `Collect shards (${shardsCollected}/${shardTarget})`, done: shardsCollected>=shardTarget },
      { text: `Read the note (E)`, done: this.isDone("read") },
      { text: `Find the key`, done: this.isDone("key") },
      { text: `Open the gate`, done: this.isDone("gate") },
      { text: `Enter the node`, done: this.isDone("node") },
      { text: `Exit the node`, done: this.isDone("exit") },
    ];
  }
}
