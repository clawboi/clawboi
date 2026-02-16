export class Input{
  constructor(atkBtn=null, dashBtn=null){
    this.keys = new Set();
    this._atk = false;
    this._dash = false;

    window.addEventListener("keydown", (e)=>{
      const k = (e.key || "").toLowerCase();
      this.keys.add(k);

      if (k === "j" || k === " ") this._atk = true;
      if (k === "k" || k === "shift") this._dash = true;
    });

    window.addEventListener("keyup", (e)=>{
      const k = (e.key || "").toLowerCase();
      this.keys.delete(k);
    });

    // mobile
    if (atkBtn){
      atkBtn.addEventListener("pointerdown", ()=>{ this._atk = true; }, { passive:true });
    }
    if (dashBtn){
      dashBtn.addEventListener("pointerdown", ()=>{ this._dash = true; }, { passive:true });
    }
  }

  end(){
    this._atk = false;
    this._dash = false;
  }

  move(){
    const left  = this.keys.has("a") || this.keys.has("arrowleft");
    const right = this.keys.has("d") || this.keys.has("arrowright");
    const up    = this.keys.has("w") || this.keys.has("arrowup");
    const down  = this.keys.has("s") || this.keys.has("arrowdown");
    return {
      x: (right?1:0) - (left?1:0),
      y: (down?1:0) - (up?1:0),
    };
  }

  attack(){ return this._atk; }
  dash(){ return this._dash; }
}

