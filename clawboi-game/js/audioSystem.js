export class AudioSystem{

constructor(){
this.map={};
}

load(name,src){
let a=new Audio(src);
a.volume=.4;
this.map[name]=a;
}

play(name){
let a=this.map[name];
if(!a)return;
a.currentTime=0;
a.play();
}

}
