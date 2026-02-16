export class Input{
  constructor(atkBtn, dashBtn){
    this.keys = Object.create(null);

    this._atkPressed = false;
    this._dashPressed = false;

    window.addEventListener("keydown", (e)=>{
      this.keys[(e.key||"").toLowerCase()] = true;
    });

    window.addEventListener("keyup", (e)=>{
      this.keys[(e.key||"").toLowerCase()] = false;
    });

    if (atkBtn){
      atkBtn.addEventListener("pointerdown", ()=>{ this._atkPressed = true; }, { passive:true });
    }
    if (dashBtn){
      dashBtn.addEventListener("pointerdown", ()=>{ this._dashPressed = true; }, { passive:true });
    }
  }

  axis(){
    const k = this.keys;
    const left  = k["a"] || k["arrowleft"];
    const right = k["d"] || k["arrowright"];
    const up    = k["w"] || k["arrowup"];
    const down  = k["s"] || k["arrowdown"];
    return {
      x: (right?1:0) - (left?1:0),
      y: (down?1:0) - (up?1:0),
    };
  }

  attack(){
    const k = this.keys;
    return !!(this._atkPressed || k["j"] || k[" "] || k["enter"]);
  }

  dash(){
    const k = this.keys;
    return !!(this._dashPressed || k["k"] || k["shift"]);
  }

  interact(){
    const k = this.keys;
    return !!(k["e"]);
  }

  end(){
    this._atkPressed = false;
    this._dashPressed = false;
  }
}
