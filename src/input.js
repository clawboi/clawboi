import { clamp } from "./utils.js";

export class Input {
  constructor({ canvas, mobileAtkBtn, mobileDashBtn }) {
    this.canvas = canvas;

    // digital
    this.keys = new Set();
    this.pressed = new Set();   // edge-trigger (down this frame)
    this.released = new Set();  // edge-trigger (up this frame)

    // virtual stick
    this.stick = { active:false, id:null, x:0, y:0, dx:0, dy:0, mag:0 };
    this.dead = 0.14;

    // mobile action buttons
    this.mobileAtk = false;
    this.mobileDash = false;

    this._bindKeyboard();
    this._bindFocusSafety();
    this._bindMobileButtons(mobileAtkBtn, mobileDashBtn);
    this._bindJoystick();
  }

  /* ---------- keyboard ---------- */
  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const k = this._normKey(e);

      // prevent page scroll for game keys
      if (this._isGameKey(k)) e.preventDefault();

      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    }, { passive:false });

    window.addEventListener("keyup", (e) => {
      const k = this._normKey(e);
      if (this.keys.has(k)) this.released.add(k);
      this.keys.delete(k);
    }, { passive:true });
  }

  _bindFocusSafety() {
    // if the browser loses focus, flush keys (prevents "stuck movement")
    window.addEventListener("blur", () => this.reset(), { passive:true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    }, { passive:true });
  }

  _normKey(e) {
    const k = (e.key || "").toLowerCase();
    if (k === " ") return "space";
    return k;
  }

  _isGameKey(k){
    return [
      "arrowup","arrowdown","arrowleft","arrowright",
      "w","a","s","d",
      "space","enter","shift","j","k"
    ].includes(k);
  }

  /* ---------- mobile buttons ---------- */
  _bindMobileButtons(atkBtn, dashBtn){
    if(atkBtn){
      const down = (e)=>{ e.preventDefault(); this.mobileAtk = true; };
      const up   = (e)=>{ e.preventDefault(); this.mobileAtk = false; };

      atkBtn.addEventListener("pointerdown", down, {passive:false});
      atkBtn.addEventListener("pointerup", up, {passive:false});
      atkBtn.addEventListener("pointercancel", up, {passive:false});
      atkBtn.addEventListener("pointerleave", up, {passive:false});
    }
    if(dashBtn){
      const down = (e)=>{ e.preventDefault(); this.mobileDash = true; };
      const up   = (e)=>{ e.preventDefault(); this.mobileDash = false; };

      dashBtn.addEventListener("pointerdown", down, {passive:false});
      dashBtn.addEventListener("pointerup", up, {passive:false});
      dashBtn.addEventListener("pointercancel", up, {passive:false});
      dashBtn.addEventListener("pointerleave", up, {passive:false});
    }
  }

  /* ---------- virtual joystick ---------- */
  _bindJoystick(){
    // left side of canvas controls movement on touch devices
    const el = this.canvas;

    const onDown = (e)=>{
      // only touch/pointer
      if (e.pointerType !== "touch") return;

      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // left half only
      if (x > 0.55) return;

      e.preventDefault();
      this.stick.active = true;
      this.stick.id = e.pointerId;
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.stick.dx = 0;
      this.stick.dy = 0;
      this.stick.mag = 0;
    };

    const onMove = (e)=>{
      if(!this.stick.active || e.pointerId !== this.stick.id) return;
      e.preventDefault();

      const dx = e.clientX - this.stick.x;
      const dy = e.clientY - this.stick.y;

      // normalize to [-1,1] using radius
      const r = 54; // feel
      let nx = clamp(dx / r, -1, 1);
      let ny = clamp(dy / r, -1, 1);

      const mag = Math.hypot(nx, ny);
      if(mag > 1e-6){
        // keep inside circle
        const m = Math.min(1, mag);
        nx = (nx / mag) * m;
        ny = (ny / mag) * m;
      }

      // deadzone
      const dm = Math.hypot(nx, ny);
      if(dm < this.dead){
        this.stick.dx = 0; this.stick.dy = 0; this.stick.mag = 0;
      }else{
        this.stick.dx = nx;
        this.stick.dy = ny;
        this.stick.mag = dm;
      }
    };

    const onUp = (e)=>{
      if(!this.stick.active || e.pointerId !== this.stick.id) return;
      e.preventDefault();
      this.stick.active = false;
      this.stick.id = null;
      this.stick.dx = 0;
      this.stick.dy = 0;
      this.stick.mag = 0;
    };

    el.addEventListener("pointerdown", onDown, {passive:false});
    el.addEventListener("pointermove", onMove, {passive:false});
    el.addEventListener("pointerup", onUp, {passive:false});
    el.addEventListener("pointercancel", onUp, {passive:false});
  }

  /* ---------- queries ---------- */
  down(k){ return this.keys.has(k); }
  hit(k){ return this.pressed.has(k); }   // pressed this frame
  up(k){ return this.released.has(k); }   // released this frame

  moveVector(){
    // keyboard digital
    let mx = 0, my = 0;
    if(this.down("a") || this.down("arrowleft")) mx -= 1;
    if(this.down("d") || this.down("arrowright")) mx += 1;
    if(this.down("w") || this.down("arrowup")) my -= 1;
    if(this.down("s") || this.down("arrowdown")) my += 1;

    // add stick
    mx += this.stick.dx;
    my += this.stick.dy;

    // normalize so diagonal isn’t faster
    const len = Math.hypot(mx, my);
    if(len > 1e-6){
      mx /= Math.min(1, len);
      my /= Math.min(1, len);
    }
    return { mx, my };
  }

  attack(){
    return this.down("j") || this.down("space") || this.mobileAtk;
  }
  dash(){
    return this.down("k") || this.down("shift") || this.mobileDash;
  }
  startPressed(){
    return this.hit("enter") || this.hit("space");
  }

  endFrame(){
    this.pressed.clear();
    this.released.clear();
  }

  reset(){
    this.keys.clear();
    this.pressed.clear();
    this.released.clear();
    this.mobileAtk = false;
    this.mobileDash = false;
    this.stick.active = false;
    this.stick.id = null;
    this.stick.dx = 0;
    this.stick.dy = 0;
    this.stick.mag = 0;
  }
}

