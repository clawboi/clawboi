export class Input {
  constructor(canvas){
    this.keys = new Set();
    this.justPressed = new Set();

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.justPressed.add(k);
      this.keys.add(k);
      // prevent arrow keys scrolling on some browsers
      if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();
    }, { passive:false });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
    });

    // iOS: tap canvas to focus controls if needed
    canvas.addEventListener("pointerdown", () => canvas.focus?.());
  }

  down(k){ return this.keys.has(k.toLowerCase()); }
  pressed(k){ return this.justPressed.has(k.toLowerCase()); }

  endFrame(){
    this.justPressed.clear();
  }

  axis(){
    const left = this.down("a") || this.down("arrowleft");
    const right = this.down("d") || this.down("arrowright");
    const up = this.down("w") || this.down("arrowup");
    const down = this.down("s") || this.down("arrowdown");
    return {
      x: (right?1:0) - (left?1:0),
      y: (down?1:0) - (up?1:0),
    };
  }
}

