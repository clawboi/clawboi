export class Input{

constructor(a,d){

this.k={};
this.p={};

addEventListener("keydown",e=>{
let k=e.key.toLowerCase();
this.k[k]=1;
this.p[k]=1;
});

addEventListener("keyup",e=>{
this.k[e.key.toLowerCase()]=0;
});

if(a)a.ontouchstart=()=>this.p.atk=1;
if(d)d.ontouchstart=()=>this.p.dash=1;
}

down(k){return this.k[k]}

mx(){return (this.down("d")||this.down("arrowright")?1:0)-(this.down("a")||this.down("arrowleft")?1:0)}
my(){return (this.down("s")||this.down("arrowdown")?1:0)-(this.down("w")||this.down("arrowup")?1:0)}

attack(){
if(this.p[" "]||this.p["j"]||this.p.atk){this.p={};return 1}
return 0
}

dash(){
if(this.p["k"]||this.p["shift"]||this.p.dash){this.p={};return 1}
return 0
}

end(){this.p={}}

}
