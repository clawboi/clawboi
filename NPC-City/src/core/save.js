export class Save {
  constructor(key){
    this.key = key;
  }

  load(){
    try{
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }

  write(data){
    try{
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    }catch{
      return false;
    }
  }

  clear(){
    try{ localStorage.removeItem(this.key); } catch {}
  }
}

