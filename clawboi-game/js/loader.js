export class Loader{

static img(src){
return new Promise(r=>{
let i=new Image();
i.onload=()=>r(i);
i.src=src;
});
}

}
