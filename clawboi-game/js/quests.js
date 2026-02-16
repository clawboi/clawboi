export class Quests{

constructor(){
this.q={
shards:false,
boss:false
};
}

done(k){this.q[k]=true}
is(k){return this.q[k]}

list(){
return[
{txt:"Collect Shards",done:this.q.shards},
{txt:"Defeat Boss",done:this.q.boss}
];
}

}
