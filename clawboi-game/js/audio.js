export class AudioSys{

constructor(){
this.map={};
}

load(name,src){
let a=new Audio(src);
this.map[name]=a;
}

play(name){
let a=this.map[name];
if(!a)return;
a.currentTime=0;
a.play();
}

}
