// ui.js
// DOM HUD sync + centered messages + toasts.

window.UI = (() => {
  const el = {
    hpFill: document.getElementById("hpFill"),
    xpFill: document.getElementById("xpFill"),
    lvl: document.getElementById("lvl"),
    atk: document.getElementById("atk"),
    spd: document.getElementById("spd"),
    hall: document.getElementById("hall"),
    slots: document.getElementById("slots"),
    centerMsg: document.getElementById("centerMsg"),
    subMsg: document.getElementById("subMsg"),
    stateHint: document.getElementById("stateHint")
  };

  function initSlots(){
    el.slots.innerHTML="";
    for(let i=0;i<10;i++){
      const d=document.createElement("div");
      d.className="slot";
      d.innerHTML="<span></span>";
      el.slots.appendChild(d);
    }
  }

  function sync(player, hallu){
    const hp = player.hp / player.hpMax;
    const xp = player.xp / player.xpNeed;
    el.hpFill.style.width = `${Math.max(0,Math.min(1,hp))*100}%`;
    el.xpFill.style.width = `${Math.max(0,Math.min(1,xp))*100}%`;
    el.lvl.textContent = player.lvl;
    el.atk.textContent = player.atk;
    el.spd.textContent = player.speed.toFixed(2);
    el.hall.textContent = `${Math.floor((hallu.meter||0)*100)}%`;
  }

  function syncInventory(inv){
    const slots = [...el.slots.children];
    for(let i=0;i<slots.length;i++){
      const s=slots[i];
      const item=inv[i];
      if(item){
        s.classList.add("on");
        s.querySelector("span").textContent = item.icon;
      }else{
        s.classList.remove("on");
        s.querySelector("span").textContent = "";
      }
    }
  }

  function setState(text){
    el.stateHint.textContent = text;
  }

  function showCenter(msg, sub){
    el.centerMsg.textContent = msg || "";
    el.subMsg.textContent = sub || "";
    el.centerMsg.classList.toggle("on", !!msg);
    el.subMsg.classList.toggle("on", !!sub);
  }

  let toastT=0;
  function toast(msg, sub){
    showCenter(msg, sub);
    toastT = 2.0;
  }

  function update(dt){
    if(toastT>0){
      toastT -= dt;
      if(toastT<=0) showCenter("", "");
    }
  }

  initSlots();

  return { sync, syncInventory, toast, update, setState, showCenter };
})();

