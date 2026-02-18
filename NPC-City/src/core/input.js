export class Input {
  constructor(canvas){
    this.keys = new Set();
    this.justPressed = new Set();

    // Capture keys at document level (more reliable than window in some cases)
    document.addEventListener("keydown", (e) => {
      const key = e.key;
      const k = key.length === 1 ? key.toLowerCase() : key.toLowerCase();

      if (!this.keys.has(k)) this.justPressed.add(k);
      this.keys.add(k);

      // Prevent scroll for arrows/space
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
    }, { passive:false });

    document.addEventListener("keyup", (e) => {
      const key = e.key;
      const k = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
      this.keys.delete(k);
    });

    // Tap to focus (helps desktop + iOS)
    canvas.addEventListener("pointerdown", () => canvas.focus?.());
  }

  down(k){ return this.keys.has(k.toLowerCase()); }
  pressed(k){ return this.justPressed.has(k.toLowerCase()); }

  endFrame(){ this.justPressed.clear(); }

  axis(){
    const left  = this.down("a") || this.down("arrowleft");
    const right = this.down("d") || this.down("arrowright");
    const up    = this.down("w") || this.down("arrowup");
    const down  = this.down("s") || this.down("arrowdown");
    return { x: (right?1:0) - (left?1:0), y: (down?1:0) - (up?1:0) };
  }
}
