export class UI {
  constructor(root){
    this.root = root;
    this.mode = "boot"; // boot | menu | play
    this.onStart = null;
    this.onContinue = null;
    this.onNew = null;

    this.hud = null;
    this.menu = null;

    this.renderBoot();
  }

  clear(){
    this.root.innerHTML = "";
    this.hud = null;
    this.menu = null;
  }

  renderBoot(){
    this.clear();
    this.mode = "boot";
    this.root.innerHTML = `
      <div class="panel">
        <h1>NPC City</h1>
        <p>Loading the city brain…</p>
        <div class="row">
          <button class="btn" id="boot-ok">Enter</button>
        </div>
      </div>
    `;
    this.root.querySelector("#boot-ok").onclick = () => {
      this.renderMenu({ hasSave:false });
    };
  }

  renderMenu({ hasSave }){
    this.clear();
    this.mode = "menu";
    this.root.innerHTML = `
      <div class="panel">
        <h1>Choose your start</h1>
        <p>V1 is small on purpose. We’re proving the foundation: movement, zones, saving, and role-based spawns.</p>

        <div class="row" style="margin-bottom:10px">
          ${hasSave ? `<button class="btn" id="continue">Continue</button>` : ``}
          <button class="btn" id="new">New Game</button>
        </div>

        <div class="row">
          <button class="btn" data-role="thug">Thug</button>
          <button class="btn" data-role="actor">Actor</button>
          <button class="btn" data-role="police">Police</button>
        </div>

        <p style="margin-top:12px; opacity:.85">
          Controls: <span class="kbd">WASD / Arrows</span>
          <span class="kbd">Shift (run)</span>
          <span class="kbd">R (reset spawn)</span>
        </p>
      </div>
    `;

    if (hasSave){
      this.root.querySelector("#continue").onclick = () => this.onContinue && this.onContinue();
    }
    this.root.querySelector("#new").onclick = () => this.onNew && this.onNew();

    this.root.querySelectorAll("[data-role]").forEach(btn=>{
      btn.onclick = () => {
        const role = btn.getAttribute("data-role");
        this.onStart && this.onStart(role);
      };
    });
  }

  renderHUD(){
    if (this.hud) return;
    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="pill" id="hud-role">ROLE</div>
      <div class="pill" id="hud-area">AREA</div>
      <div class="pill" id="hud-money">$0</div>
    `;
    this.root.appendChild(hud);

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.innerHTML = `
      <div class="kbd">WASD</div>
      <div class="kbd">Shift</div>
      <div class="kbd">R</div>
    `;
    this.root.appendChild(corner);

    this.hud = hud;
    this.corner = corner;
  }

  setHUD({ role, area, money }){
    this.renderHUD();
    this.root.querySelector("#hud-role").textContent = role.toUpperCase();
    this.root.querySelector("#hud-area").textContent = area;
    this.root.querySelector("#hud-money").textContent = `$${money}`;
  }

  hideMenu(){
    // remove only menu panel if present
    const panel = this.root.querySelector(".panel");
    if (panel) panel.remove();
  }
}

