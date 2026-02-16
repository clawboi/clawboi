export class Clock{

constructor(){
this.last=performance.now();
this.dt=0;
this.time=0;
}

tick(){
let n=performance.now();
this.dt=Math.min(.05,(n-this.last)/1000);
this.time+=this.dt;
this.last=n;
return this.dt;
}

}
