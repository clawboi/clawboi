export class Bus{

constructor(){this.map={}}

on(n,f){(this.map[n]||(this.map[n]=[])).push(f)}

emit(n,d){
let l=this.map[n];
if(!l)return;
for(let f of l)f(d);
}

}
