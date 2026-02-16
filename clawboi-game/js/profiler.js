export class Profiler{

constructor(){
this.frames=0;
this.time=0;
this.fps=0;
}

tick(dt){
this.frames++;
this.time+=dt;
if(this.time>1){
this.fps=this.frames;
this.frames=0;
this.time=0;
}
}

}
