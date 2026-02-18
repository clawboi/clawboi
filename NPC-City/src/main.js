import { Assets } from "./core/assets.js";
import { Input } from "./core/input.js";
import { Save } from "./core/save.js";
import { Game } from "./core/game.js";
import { UI } from "./ui/ui.js";
import { World } from "./world/world.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const input = new Input(canvas);
const save = new Save("NPC_CITY_SAVE_V1");
const ui = new UI(document.getElementById("ui-root"));
const assets = new Assets();
const world = new World();
const game = new Game({ canvas, ctx, input, save, ui, assets, world });

game.boot();
