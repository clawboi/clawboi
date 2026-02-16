export const Save={

set(k,v){localStorage.setItem(k,JSON.stringify(v))},

get(k){
let v=localStorage.getItem(k);
return v?JSON.parse(v):null;
}

};
